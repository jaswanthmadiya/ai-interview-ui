import { useCallback, useEffect, useRef, useState } from "react";
import { wsBaseUrl } from "./api";

export type ChatMessage = { id: number; role: "ai" | "user"; text: string };

export type MicUiState = "idle" | "listening" | "paused" | "processing" | "ai_speaking";

export type ConnectionStatus = "connecting" | "connected" | "error" | "voice_unavailable";

interface UseInterviewSessionResult {
  messages: ChatMessage[];
  micState: MicUiState;
  connectionStatus: ConnectionStatus;
  draft: string;
  setDraft: (value: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  sendAnswer: () => void;
  clearDraft: () => void;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentPhase: string;
  responseDeadlineSeconds: number | null;
  finished: boolean;
  errorMessage: string | null;
}

/**
 * Owns the entire live interview WebSocket connection: push-to-talk audio
 * capture (a fresh MediaRecorder + a fresh Deepgram session per press, kept
 * in sync — see the backend's routes_audio.py for why), the
 * dictate-into-draft protocol (releasing the mic never auto-submits; only
 * an explicit sendAnswer() does), and PCM audio playback for the
 * interviewer's spoken responses.
 */
export function useInterviewSession(sessionId: string | null): UseInterviewSessionResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [micState, setMicState] = useState<MicUiState>("idle");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [draft, setDraftState] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentPhase, setCurrentPhase] = useState("interview");
  const [responseDeadlineSeconds, setResponseDeadlineSeconds] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const nextMessageIdRef = useRef(1);

  // Playback: raw linear16 PCM (24kHz mono) — streamed chunk-by-chunk via Web
  // Audio as data arrives instead of waiting for audio_end, so first speech
  // lands with minimal latency.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const receivingAudioRef = useRef(false);
  const playbackQueueRef = useRef<Promise<void>>(Promise.resolve());
  const deadlineTickingRef = useRef(false);
  // nextStartTimeRef tracks where the next scheduled buffer should begin so
  // chunks are stitched together without gaps or overlaps.
  const nextStartTimeRef = useRef<number>(0);

  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (!audioCtxRef.current) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audioCtxRef.current = new AC();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Schedule a single PCM chunk for immediate streaming playback.
  // Uses precise AudioContext scheduling so chunks stitch seamlessly.
  const scheduleChunk = useCallback(
    (chunk: ArrayBuffer) => {
      if (chunk.byteLength === 0) return;
      const ctx = ensureAudioContext();
      if (!ctx) return;

      const sampleCount = Math.floor(chunk.byteLength / 2);
      if (sampleCount === 0) return;
      const int16 = new Int16Array(chunk, 0, sampleCount);
      const float32 = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        float32[i] = (int16[i] ?? 0) / 32768;
      }

      const buffer = ctx.createBuffer(1, sampleCount, 24000);
      buffer.copyToChannel(float32, 0);
      const duration = buffer.duration;

      const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current);
      nextStartTimeRef.current = startAt + duration;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      try {
        src.start(startAt);
      } catch {
        // context may have been closed
      }
    },
    [ensureAudioContext],
  );

  // Server sends the deadline duration once when it arms; tick it down
  // client-side for a live countdown display. The server remains the
  // authoritative enforcer regardless of what this shows.
  const deadlineIsArmed = responseDeadlineSeconds !== null;

  useEffect(() => {
    if (!deadlineTickingRef.current || !deadlineIsArmed) return;
    const id = setInterval(() => {
      setResponseDeadlineSeconds((s) => {
        if (s === null || s <= 1) {
          deadlineTickingRef.current = false;
          return null;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [deadlineIsArmed]);

  const setDraft = useCallback((value: string) => setDraftState(value), []);

  const clearDraft = useCallback(() => {
    setDraftState("");
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "clear_draft" }));
    }
  }, []);

  // -----------------------------------------------------------------
  // WebSocket lifecycle
  // -----------------------------------------------------------------

  useEffect(() => {
    if (!sessionId) return;

    setConnectionStatus("connecting");
    const socket = new WebSocket(`${wsBaseUrl()}/ws/interview/${sessionId}`);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.onerror = () => {
      setConnectionStatus("error");
      setErrorMessage("The live connection had an error — you can still type your answers.");
    };
    socket.onclose = () => setConnectionStatus((s) => (s === "error" ? s : "error"));

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        // Stream-play each binary chunk immediately as it arrives
        if (receivingAudioRef.current) scheduleChunk(event.data as ArrayBuffer);
        return;
      }

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }

      switch (msg["type"]) {
        case "transcript": {
          const text = String(msg["text"] ?? "");
          setMessages((prev) => [...prev, { id: nextMessageIdRef.current++, role: "user", text }]);
          break;
        }
        case "ai_text": {
          const text = String(msg["text"] ?? "");
          setMessages((prev) => [...prev, { id: nextMessageIdRef.current++, role: "ai", text }]);
          if (typeof msg["phase"] === "string") setCurrentPhase(msg["phase"]);
          if (typeof msg["current_question_index"] === "number") {
            setCurrentQuestionIndex(msg["current_question_index"]);
          }
          if (typeof msg["total_questions"] === "number") setTotalQuestions(msg["total_questions"]);
          if (msg["finished"] === true) setFinished(true);
          break;
        }
        case "draft_ready": {
          setDraftState(String(msg["text"] ?? ""));
          setMicState("paused");
          break;
        }
        case "partial_transcript": {
          // Live interim caption while actively dictating — merged into the
          // draft optimistically so the candidate sees speech land in real
          // time rather than only once the press ends.
          if (isRecordingRef.current) setDraftState(String(msg["text"] ?? ""));
          break;
        }
        case "audio_start":
          receivingAudioRef.current = true;
          // Reset scheduling clock so new utterance starts from current time
          nextStartTimeRef.current = 0;
          break;
        case "audio_end":
          receivingAudioRef.current = false;
          break;
        case "state": {
          if (msg["state"] === "processing") setMicState("processing");
          else if (msg["state"] === "ai_speaking") setMicState("ai_speaking");
          else if (msg["state"] === "ready") setMicState((s) => (s === "listening" ? s : "idle"));
          break;
        }
        case "response_deadline":
          setResponseDeadlineSeconds(typeof msg["seconds"] === "number" ? msg["seconds"] : null);
          deadlineTickingRef.current = true;
          break;
        case "response_timeout":
          setResponseDeadlineSeconds(null);
          deadlineTickingRef.current = false;
          break;
        case "force_stop_recording":
          stopRecordingInternal(false);
          setMicState("paused");
          break;
        case "no_speech_detected":
          break;
        case "ready":
          setConnectionStatus("connected");
          break;
        case "voice_unavailable":
          setConnectionStatus("voice_unavailable");
          break;
        case "error":
          setErrorMessage(
            typeof msg["message"] === "string" ? msg["message"] : "An error occurred.",
          );
          break;
        case "interview_complete":
          setFinished(true);
          break;
        default:
          break;
      }
    };

    return () => {
      try {
        socket.close();
      } catch {
        // already closed
      }
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, scheduleChunk]);

  // -----------------------------------------------------------------
  // Push-to-talk capture — a fresh MediaRecorder per press, mirroring the
  // backend opening a fresh Deepgram connection per press. Recreating both
  // together is what keeps them in sync (see backend comments).
  // -----------------------------------------------------------------

  const startRecording = useCallback(() => {
    if (micState !== "idle" && micState !== "paused") return;
    if (isRecordingRef.current) return;

    // Clear draft immediately so the old transcript doesn't flash
    // while we wait for the new partial_transcript to arrive.
    setDraftState("");

    deadlineTickingRef.current = false;
    setResponseDeadlineSeconds(null);

    void (async () => {
      ensureAudioContext();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        setErrorMessage(
          `Microphone access error: ${err instanceof Error ? err.message : String(err)} — you can still type your answer.`,
        );
        return;
      }

      micStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        void e.data.arrayBuffer().then((buf) => {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(buf);
          }
        });
      };
      recorder.start(250);

      isRecordingRef.current = true;
      setMicState("listening");

      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ptt_start" }));
      }
    })();
  }, [micState, ensureAudioContext]);

  const stopRecordingInternal = useCallback((notifyServer: boolean) => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // already stopped
      }
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    micStreamRef.current = null;

    if (notifyServer) {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ptt_stop" }));
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    stopRecordingInternal(true);
    // Optimistic — the server always replies with either draft_ready or
    // no_speech_detected+ready, so this is guaranteed to resolve either way.
    setMicState("processing");
  }, [stopRecordingInternal]);

  const sendAnswer = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setErrorMessage("Connection not ready yet — please wait a moment and try again.");
      return;
    }
    socket.send(JSON.stringify({ type: "typed_turn", text }));
    setDraftState("");
    setMicState("processing");
  }, [draft]);

  useEffect(
    () => () => {
      stopRecordingInternal(false);
      if (audioCtxRef.current) void audioCtxRef.current.close();
    },
    [stopRecordingInternal],
  );

  return {
    messages,
    micState,
    connectionStatus,
    draft,
    setDraft,
    startRecording,
    stopRecording,
    sendAnswer,
    clearDraft,
    currentQuestionIndex,
    totalQuestions,
    currentPhase,
    responseDeadlineSeconds,
    finished,
    errorMessage,
  };
}
