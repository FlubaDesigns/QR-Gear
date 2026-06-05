/**
 * memberFetch — central authenticated fetch utility for all member API calls.
 *
 * Same pattern as adminFetch but uses /api/members as the base URL.
 *
 * Usage:
 *   const data = await memberFetch('/packets?memberId=' + id);
 *   const result = await memberFetch('/packets/' + id, { method: 'POST', json: payload });
 */

import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const MEMBER_BASE = "/api/members";

async function getMemberToken(): Promise<string | null> {
  if (import.meta.env.VITE_ADMIN_BYPASS === "true") {
    return null;
  }

  let user = auth.currentUser;

  if (!user) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("[memberFetch] Auth state timeout after 5s");
        resolve();
      }, 5000);

      const unsub = onAuthStateChanged(auth, () => {
        clearTimeout(timeout);
        unsub();
        resolve();
      });
    });
    user = auth.currentUser;
  }

  if (!user) {
    console.error("[memberFetch] No authenticated user found after timeout");
    throw new Error("User not authenticated");
  }

  return user.getIdToken();
}

export interface MemberFetchOptions extends Omit<RequestInit, "body"> {
  json?: unknown;
  body?: BodyInit | null;
}

export async function memberFetch<T = unknown>(
  path: string,
  options: MemberFetchOptions = {}
): Promise<T> {
  const token = await getMemberToken();

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
    : `${MEMBER_BASE}${path.startsWith("/") ? path : `/${path}`}`;

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
    const msg = `[memberFetch] ${rest.method ?? "GET"} ${url} → ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`;
    console.error(msg);
    throw new Error(msg);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (res.status === 204 || !contentType.includes("application/json")) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
