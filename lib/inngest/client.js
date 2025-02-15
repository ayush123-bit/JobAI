import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "Job AI",
  name: "AI guide",
  credentials: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
  },
});