import { dahonoApiKey, getDahonoModels } from "@/lib/assistant/dahonoGateway";
import { requireAuth } from "@/lib/assistant/auth";
import { flagshipCreditsRemaining } from "@/lib/assistant/flagshipCredits";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const ready = Boolean(dahonoApiKey());
  const [models, credits] = await Promise.all([
    getDahonoModels(),
    authorization && ready
      ? requireAuth(authorization).then(auth => auth.userId ? flagshipCreditsRemaining(auth.userId) : null).catch(() => null)
      : null,
  ]);
  return Response.json({ dahono: { ready, models, credits } }, {
    headers: { "Cache-Control": "no-store" },
  });
}
