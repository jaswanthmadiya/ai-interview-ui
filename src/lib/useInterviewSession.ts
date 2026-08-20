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
  firstAudioReceived: boolean;
}

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

/**
 * Owns the live interview WebSocket connection: dictation into draft via
 * browser speech recognition (releasing the mic only populates the editable draft;
 * NEVER auto-submits to LLM), explicit turn submission via typed_turn, and PCM
 * audio streaming playback for the interviewer's spoken responses.
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
  // Flips true the moment the first binary audio chunk arrives — used to hide
  // the chat UI until the intro audio actually starts playing.
  const [firstAudioReceived, setFirstAudioReceived] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const nextMessageIdRef = useRef(1);

  // Playback: raw linear16 PCM (24kHz mono) — streamed chunk-by-chunk via Web
  // Audio as data arrives instead of waiting for audio_end, so first speech
  // lands with minimal latency.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const receivingAudioRef = useRef(false);
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
        // Signal that the first utterance has started so the chat UI reveals itself
        setFirstAudioReceived(true);
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
          // Deduplicate if already added optimistically
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "user" && last.text === text) {
              return prev;
            }
            return [...prev, { id: nextMessageIdRef.current++, role: "user", text }];
          });
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
          stopRecordingInternal();
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
  // Push-to-talk speech recognition:
  // Transcribes user speech locally in real-time into `draft`.
  // Releasing the mic NEVER triggers LLM processing on the backend;
  // it only places the final transcript in the editable text box.
  // -----------------------------------------------------------------

  const stopRecordingInternal = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
    }

    setMicState("paused");
  }, []);

  const startRecording = useCallback(() => {
    if (micState !== "idle" && micState !== "paused") return;
    if (isRecordingRef.current) return;

    // Reset draft for the new dictation
    setDraftState("");
    deadlineTickingRef.current = false;
    setResponseDeadlineSeconds(null);

    const win = window as unknown as IWindowWithSpeech;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage("Voice recognition is not supported in this browser. You can type your answers directly.");
      setMicState("paused");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res && res[0]) {
            if (res.isFinal) {
              final += res[0].transcript + " ";
            } else {
              interim += res[0].transcript;
            }
          }
        }
        const combined = (final + interim).trim();
        if (combined) {
          setDraftState(combined);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("Speech recognition warning:", event.error);
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      isRecordingRef.current = true;
      setMicState("listening");
    } catch (err) {
      setErrorMessage(
        `Microphone access error: ${err instanceof Error ? err.message : String(err)} — you can still type your answer.`,
      );
      setMicState("paused");
    }
  }, [micState]);

  const stopRecording = useCallback(() => {
    stopRecordingInternal();
  }, [stopRecordingInternal]);

  // Explicit send to LLM triggered ONLY by the Up Arrow button
  const sendAnswer = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setErrorMessage("Connection not ready yet — please wait a moment and try again.");
      return;
    }

    // Send the turn to the backend WebSocket to run the LLM graph
    socket.send(JSON.stringify({ type: "typed_turn", text }));
    // Optimistically render candidate's submitted answer
    setMessages((prev) => [...prev, { id: nextMessageIdRef.current++, role: "user", text }]);
    setDraftState("");
    setMicState("processing");
  }, [draft]);

  useEffect(
    () => () => {
      stopRecordingInternal();
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
    firstAudioReceived,
  };
}

