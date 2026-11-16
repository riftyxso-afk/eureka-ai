import { toast as ding } from "@yusufceng1z/ding-react";

let showSakuga: ((text: string) => void) | undefined;

export function bindSuccessToast(show: (text: string) => void) {
  showSakuga = show;
  return () => { if (showSakuga === show) showSakuga = undefined; };
}

export const toast: typeof ding = {
  ...ding,
  success(title, options) {
    // Leave notifications with actions, IDs, or custom timing in the original store.
    if (!showSakuga || (options && Object.keys(options).some(key => key !== "description"))) return ding.success(title, options);
    showSakuga(options?.description ? `${title} — ${options.description}` : title);
    return `sakuga-${Date.now()}`;
  },
};
