/**
 * adminFetch — central authenticated fetch utility for all admin API calls.
 *
 * Replaces the scattered pattern of:
 *   const { apiBase, getAuthHeaders } = useAdminAuth();
 *   const headers = await getAuthHeaders();
 *   const res = await fetch(`${apiBase}/something`, { headers, ... });
 *
 * Usage:
 *   const data = await adminFetch('/products');
 *   const result = await adminFetch('/packets/' + id, { method: 'POST', json: payload });
 *   await adminFetch('/store-product-links/' + id, { method: 'DELETE' });
 *
 * Features:
 *   - Prepends /api/admin automatically
 *   - Gets Firebase ID token automatically (waits for auth to initialize)
 *   - Sets Content-Type: application/json when json option is provided
 *   - Throws loudly with descriptive error on non-OK responses (fail-loudly)
 *   - Returns parsed JSON (or undefined for empty responses like 204)
 */

import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const ADMIN_BASE = "/api/admin";

async function getAdminToken(): Promise<string | null> {
  if (import.meta.env.VITE_ADMIN_BYPASS === "true") {
    return null;
  }

  let user = auth.currentUser;

  if (!user) {
    await new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(auth, (u) => {
        unsub();
        resolve();
      });
    });
    user = auth.currentUser;
  }

  if (!user) {
    console.error("[adminFetch] No authenticated user found");
    return null;
  }

  return user.getIdToken(true);
}

export interface AdminFetchOptions extends Omit<RequestInit, "body"> {
  json?: unknown;
  body?: BodyInit | null;
}

export async function adminFetch<T = unknown>(
  path: string,
  options: AdminFetchOptions = {}
): Promise<T> {
  const token = await getAdminToken();

  const { json, ...rest } = options;

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";

  if (options.headers) {
    const incoming = options.headers as Record<string, string>;
    Object.assign(headers, incoming);
  }

  const url = path.startsWith("http")
    ? path
    : `${ADMIN_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const body: BodyInit | null | undefined =
    json !== undefined ? JSON.stringify(json) : rest.body;

  const res = await fetch(url, { ...rest, headers, body });

  if (!res.ok) {
    let detail = "";
    try {
      const errData = await res.json();
      detail = errData?.error || errData?.message || "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    const msg = `[adminFetch] ${rest.method ?? "GET"} ${url} → ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`;
    console.error(msg);
    throw new Error(msg);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (res.status === 204 || !contentType.includes("application/json")) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
