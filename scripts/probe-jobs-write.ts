/** Probe: tulis langsung ke tabel jobs via admin client — cetak error asli. */
import { randomUUID } from "crypto";
import { db } from "../lib/supabase/admin";

async function main() {
  const id = randomUUID();
  const { error } = await db()
    .from("jobs")
    .upsert(
      {
        id,
        progress: 50,
        status: "processing",
        message: "probe",
        note_id: null,
        result: { noteTitle: null, error: null, cancelled: false, userId: "probe" },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  console.log("upsert error:", error ? JSON.stringify(error) : null);
  const { data } = await db().from("jobs").select("id,status").eq("id", id).maybeSingle();
  console.log("read back:", JSON.stringify(data));
  await db().from("jobs").delete().eq("id", id);
  console.log("probe selesai.");
}
void main();
