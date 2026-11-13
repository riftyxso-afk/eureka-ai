/** Server-only egress route for hosts that cannot reach Supabase directly. */
export function supabaseTransport(
  projectUrl: string,
  relayUrl = process.env.SUPABASE_RELAY_URL,
  relaySecret = process.env.SUPABASE_RELAY_SECRET,
  send: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const target = new URL(request.url);
    const project = new URL(projectUrl);
    if (target.origin !== project.origin) throw new Error("Unexpected Supabase destination");
    const headers = new Headers(request.headers);
    let destination = target.href;
    if (relayUrl && relaySecret) {
      const relay = new URL(relayUrl);
      if (relay.protocol !== "https:") throw new Error("Supabase relay requires HTTPS");
      relay.searchParams.set("path", target.pathname + target.search);
      destination = relay.href;
      headers.set("x-eureka-relay-secret", relaySecret);
    }
    return send(destination, {
      method: request.method, headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]),
      redirect: "error", cache: "no-store",
    });
  };
}
