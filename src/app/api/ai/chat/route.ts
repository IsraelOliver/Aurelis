import { handleChat } from "@/lib/ai/chat-handler";
import { getAurelisAIProvider } from "@/lib/ai/openai";
import { PERSONAL_PROFILE } from "@/lib/ai/profile";
import { requireAuth } from "@/lib/auth";

/**
 * SMILEY (read-only personal intelligence): browser → this route → OpenAI
 * Responses API. OPENAI_API_KEY and the personal profile stay on the server;
 * the browser never calls OpenAI and never chooses the model.
 * See src/lib/ai/chat-handler.ts and docs/AI_ARCHITECTURE.md.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  return handleChat(request, getAurelisAIProvider(), PERSONAL_PROFILE);
}
