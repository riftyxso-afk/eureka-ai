/** Retry only recoverable reads; never turn an unavailable entitlement into Pro. */
export async function requestPremiumStatus(
  request: () => Promise<Response>,
  refreshSession: () => Promise<boolean>,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  let refreshed = false;
  let retried = false;
  while (true) {
    signal.throwIfAborted();
    let response: Response;
    try { response = await request(); }
    catch (error) {
      signal.throwIfAborted();
      if (!retried) { retried = true; continue; }
      throw error;
    }
    if (response.status === 401 && !refreshed) {
      refreshed = true;
      if (await refreshSession()) continue;
      throw new Error("Sesi akun berakhir. Silakan masuk kembali.");
    }
    if ((response.status >= 500 || response.status === 408) && !retried) {
      retried = true;
      await response.body?.cancel().catch(() => {});
      continue;
    }
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? "Sesi akun belum valid. Silakan masuk kembali."
      : "Status paket belum bisa dimuat. Silakan coba lagi.");
    const data = await response.json();
    if (!data || typeof data.isPremium !== "boolean") throw new Error("Respons status paket belum valid. Silakan coba lagi.");
    return data;
  }
}
