# Supabase connectivity on the VPS

On 2026-11-13 the VPS returned ENETUNREACH for both Supabase IPv4 addresses,
while the same freshly issued user token succeeded through Vercel. Auth network
failures must return 503, never an invalid-session 401.

`lib/supabase/transport.ts` supports an explicit server-only transport:

- Vercel: configure `SUPABASE_RELAY_SECRET` (random 32 bytes or more).
- VPS: configure the same secret and `SUPABASE_RELAY_URL` pointing to
  `https://www.eureka-ai.web.id/api/internal/supabase`.
- Do not set the relay URL on Vercel. The endpoint fetches Supabase directly.
- Never prefix either variable with `NEXT_PUBLIC_`, log the secret, or expose it to clients.

Deploy the Vercel endpoint before restarting the VPS with this transport.
The relay accepts only the configured Supabase origin and auth/rest/storage API
paths, checks its private credential in constant time, preserves the original
Supabase authorization, and rejects redirects. It does not mint tokens or grant
entitlements. Requests are sent once to the configured route, avoiding mutation
replays after ambiguous network failures. No relay route is mounted in Hono.

To return to direct VPS egress after provider networking recovers, remove
`SUPABASE_RELAY_URL` from the VPS environment and restart the backend.

Verify using a disposable account: authenticate, request payments/status,
profile and progress through the public VPS URL; remove the account afterward.
Unauthenticated requests must remain 401.
