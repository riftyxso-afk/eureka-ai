import { db } from "../supabase/admin";
import { FLAGSHIP_STARTING_CREDITS } from "./dahonoModels";

export async function flagshipCreditsRemaining(userId: string): Promise<number | null> {
  const { data, error } = await db().from("assistant_flagship_credits")
    .select("remaining").eq("user_id", userId).maybeSingle();
  if (error) return null;
  return data?.remaining ?? FLAGSHIP_STARTING_CREDITS;
}

/** Atomically charge once for a Flagship request. null means the balance was already empty. */
export async function consumeFlagshipCredit(userId: string): Promise<number | null> {
  const { data, error } = await db().rpc("consume_assistant_flagship_credit", { p_user_id: userId });
  if (error) throw new Error("Saldo Flagship belum dapat diperiksa.");
  return typeof data === "number" ? data : null;
}
