type Event =
  | { name: "v2_account_page_viewed"; properties: { surface: "streaks" | "profil" | "pricing" } }
  | { name: "streak_milestone_celebrated"; properties: { days: number } }
  | { name: "v2_pro_checkout_started"; properties: { surface: "pricing" } };

let sdk: Promise<typeof import("posthog-js")["default"]> | undefined;
const allowedEvents = new Set(["v2_account_page_viewed", "streak_milestone_celebrated", "v2_pro_checkout_started"]);

/** Capture aggregate product usage without profile data, page URLs or student content. */
export function captureProductEvent(event: Event) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!token || typeof window === "undefined") return;

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
      person_profiles: "never",
      persistence: "memory",
      before_send: data => {
        if (!data || !allowedEvents.has(data.event)) return null;
        const { distinct_id, surface, days } = data.properties;
        return { ...data, properties: { distinct_id, surface, days, $process_person_profile: false } };
      },
    });
    return posthog;
  });
  void sdk.then(posthog => posthog.capture(event.name, event.properties)).catch(() => { sdk = undefined; });
}
