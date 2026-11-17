const eurekaMeasurementId = "G-FBVXRKP37Y";
const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ??
  (process.env.NODE_ENV === "production" ? eurekaMeasurementId : "");
export const googleMeasurementId = /^G-[A-Z0-9]+$/.test(measurementId) ? measurementId : "";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

const publicPages = new Set(["/", "/pricing", "/register", "/login", "/join", "/launch", "/privacy", "/terms"]);
const appPages = new Set(["dashboard", "dashboard-v2", "chat", "notes", "onboarding"]);
const siteOrigin = "https://www.eureka-ai.web.id";
let initialized = false;

function googleTag() {
  if (!googleMeasurementId || typeof window === "undefined" || location.origin !== siteOrigin) return;
  const analyticsWindow = window as AnalyticsWindow;
  analyticsWindow.dataLayer ??= [];
  if (!analyticsWindow.gtag) {
    analyticsWindow.gtag = function () { analyticsWindow.dataLayer!.push(arguments); };
  }
  const tag = analyticsWindow.gtag;
  if (!initialized) {
    tag("js", new Date());
    tag("config", googleMeasurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: siteOrigin,
      page_referrer: "",
      page_title: "Eureka AI",
    });
    initialized = true;
  }
  return tag;
}

export function captureGooglePageView(pathname: string) {
  const locale = pathname.match(/^\/(id|en)(?=\/|$)/)?.[0] ?? "";
  const path = pathname.slice(locale.length) || "/";
  const segment = path.split("/")[1];
  const page = publicPages.has(path) ? path : appPages.has(segment) ? "/" + segment : "/app";
  let referrer = "";
  try {
    const source = new URL(document.referrer);
    if (source.origin !== siteOrigin && ["https:", "http:"].includes(source.protocol)) referrer = source.origin;
  } catch {
    // Direct visits and opaque referrers need no value.
  }
  googleTag()?.("event", "page_view", {
    page_location: locale && page === "/" ? siteOrigin + locale : siteOrigin + locale + page,
    page_referrer: referrer,
    page_title: "Eureka AI",
  });
}

export function captureGoogleEvent(name: string, properties?: Record<string, string | number>) {
  googleTag()?.("event", name, properties ?? {});
}
