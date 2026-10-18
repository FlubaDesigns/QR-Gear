import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { auth } from "./firebase";
import { Nexus } from "@/lib/nexus";

function getApiUrl(path: string): string {
  return path;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  // Wait for Firebase Auth to finish initializing before checking currentUser
  // This prevents race conditions where queries fire before auth state is restored
  try {
    await auth.authStateReady();
  } catch {
    // authStateReady might not be available in older Firebase versions
  }
  
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    } catch {
      return {};
    }
  }
  return {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  await auth.authStateReady();
  const requestUid = auth.currentUser?.uid ?? null;
  const authHeader = await getAuthHeader();

  const res = await Nexus.retry(
    async () => {
      if ((auth.currentUser?.uid ?? null) !== requestUid) throw new Error('Account changed; try again.');
      const r = await fetch(getApiUrl(url), {
        method,
        headers: {
          ...(data ? { "Content-Type": "application/json" } : {}),
          ...authHeader,
        },
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });

      if (!r.ok && (r.status === 429 || (r.status >= 500 && r.status <= 599))) {
        throw new Error(`HTTP ${r.status} ${r.statusText}`);
      }

      return r;
    },
    {
      source: "apiRequest",
      tries: 3,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      meta: { method, url },
      shouldRetry: (err) => {
        const msg = (err?.message || "").toLowerCase();
        return (
          msg.includes("http 429") ||
          msg.includes("http 5") ||
          msg.includes("failed to fetch") ||
          msg.includes("network")
        );
      },
    }
  );

  await throwIfResNotOk(res);
  if ((auth.currentUser?.uid ?? null) !== requestUid) throw new Error('Account changed; try again.');
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    await auth.authStateReady();
    const requestUid = auth.currentUser?.uid ?? null;
    const scope = queryKey.find(part => part && typeof part === "object" && "scopeUid" in part) as { scopeUid: string | null } | undefined;
    if (scope && scope.scopeUid !== requestUid) throw new Error("Account changed; reload your data.");
    const authHeader = await getAuthHeader();
    const url = getApiUrl(queryKey.filter(part => !(part && typeof part === "object" && "scopeUid" in part)).join("/") as string);

    const res = await Nexus.retry(
      async () => {
        if ((auth.currentUser?.uid ?? null) !== requestUid) throw new Error("Account changed; reload your data.");
        const r = await fetch(url, {
          signal,
          credentials: "include",
          headers: authHeader,
        });

        if (!r.ok && (r.status === 429 || (r.status >= 500 && r.status <= 599))) {
          throw new Error(`HTTP ${r.status} ${r.statusText}`);
        }

        return r;
      },
      {
        source: "getQueryFn",
        tries: 3,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        meta: { url },
        shouldRetry: (err) => {
          const msg = (err?.message || "").toLowerCase();
          return (
            msg.includes("http 429") ||
            msg.includes("http 5") ||
            msg.includes("failed to fetch") ||
            msg.includes("network")
          );
        },
      }
    );

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    if ((auth.currentUser?.uid ?? null) !== requestUid) throw new Error("Account changed; reload your data.");
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
