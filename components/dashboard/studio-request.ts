"use client";

import { apiFetch } from "@/lib/apiClient";

export async function studioRequest<T>(
  endpoint: "study-sources" | "research-projects",
  options: { body?: unknown; id?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const path = "/api/" + endpoint + (options.id ? "?id=" + encodeURIComponent(options.id) : "");
  const response = await apiFetch(path, {
    method: options.body ? "POST" : "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Studio belum bisa memuat data.");
  return data;
}
