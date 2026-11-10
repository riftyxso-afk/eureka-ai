type Event =
  | { name: "v2_account_page_viewed"; properties: { surface: "streaks" | "profil" | "pricing" } }
  | { name: "streak_milestone_celebrated"; properties: { days: number } }
  | { name: "v2_pro_checkout_started"; properties: { surface: "pricing" } };

let sdk: Promise<typeof import("posthog-js")["default"]> | undefined;
const allowedEvents = new Set(["v2_account_page_viewed", "streak_milestone_celebrated", "v2_pro_checkout_started", "chat_response_received"]);

function getAnalytics() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!token || typeof window === "undefined") return Promise.resolve(undefined);

  sdk ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(token, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      person_profiles: "identified_only",
      persistence: "localStorage",
      before_send: data => {
        if (!data || (!allowedEvents.has(data.event) && !["$pageview", "$identify", "account_session_started"].includes(data.event))) return null;
        // Keep SDK identity/session metadata, but remove URLs that may contain
        // note IDs, chat IDs, OAuth tokens or private query strings.
        const properties = { ...data.properties };
        for (const key of ["$current_url", "$pathname", "$referrer", "$initial_current_url", "$initial_pathname", "$initial_referrer", "$set", "$set_once"]) delete properties[key];
        return { ...data, properties };
      },
    });
    return posthog;
  });
  return sdk;
}

export function captureProductEvent(event: Event) {
  void getAnalytics().then(posthog => posthog?.capture(event.name, event.properties)).catch(() => { sdk = undefined; });
}

export function identifyAnalyticsUser(userId: string) {
  if (!userId) return;
  void getAnalytics().then(posthog => {
    if (!posthog) return;
    if (posthog._isIdentified() && posthog.get_distinct_id() !== userId) posthog.reset();
    posthog.identify(userId);
  }).catch(() => { sdk = undefined; });
}

export function resetAnalyticsUser() {
  void getAnalytics().then(posthog => posthog?.reset()).catch(() => { sdk = undefined; });
}

export function capturePageView(pathname: string) {
  const page = pathname.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id");
  void getAnalytics().then(posthog => posthog?.capture("$pageview", { page })).catch(() => { sdk = undefined; });
}

export function captureChatResponse() {
  void getAnalytics().then(posthog => posthog?.capture("chat_response_received")).catch(() => { sdk = undefined; });
}
