import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { OnboardingFlow } from "@/components/OnboardingFlow";

const searchSchema = z.object({
  assessment_id: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Welcome — AI Chat Simulation" },
      {
        name: "description",
        content:
          "Participate in a 10–15 minute voice conversation with an AI character based on a realistic workplace situation.",
      },
      { property: "og:title", content: "AI Business Simulation — AI Chat Simulation" },
      {
        property: "og:description",
        content:
          "Participate in a 10–15 minute voice conversation with an AI character based on a realistic workplace situation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingFlow,
});
