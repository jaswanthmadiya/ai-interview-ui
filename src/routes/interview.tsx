import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

// The backend's shareable_link is built as `/interview?assessment_id=...`
// (see routes_setup.py) — this route exists purely so that link resolves
// correctly, redirecting straight through to the actual landing page at
// "/" with the same query string. Without this, a real published
// assessment link 404s, since "/" is where the candidate flow actually
// lives.
const searchSchema = z.object({
  assessment_id: z.string().optional(),
});

export const Route = createFileRoute("/interview")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/", search });
  },
});
