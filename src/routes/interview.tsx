import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { OnboardingFlow } from "@/components/OnboardingFlow";

const searchSchema = z.object({
  assessment_id: z.string().optional(),
});

export const Route = createFileRoute("/interview")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Welcome — AI Chat Simulation" },
      {
        name: "description",
        content:
          "Participate in a 10–15 minute voice conversation with an AI character based on a realistic workplace situation.",
      },
    ],
  }),
  component: OnboardingFlow,
});
