import { dahonoApiKey, getDahonoModels } from "@/lib/assistant/dahonoGateway";

export async function GET() {
  return Response.json({ dahono: { ready: Boolean(dahonoApiKey()), models: await getDahonoModels() } }, {
    headers: { "Cache-Control": "no-store" },
  });
}
