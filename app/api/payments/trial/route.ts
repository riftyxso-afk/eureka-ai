import { requireAuth } from "@/lib/assistant/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAuth(req.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  return Response.json({
    error: "Mulai berlangganan Eureka Pro untuk membuka fitur belajar.",
    upgradeUrl: "/dashboard-v2/pricing",
  }, { status: 402 });
}
