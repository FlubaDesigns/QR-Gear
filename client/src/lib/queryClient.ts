import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { auth } from "./firebase";

function getApiUrl(path: string): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.includes("qrgear-c1ffd.web.app") || host.includes("qrgear-c1ffd.firebaseapp.com")) {
      if (path.startsWith("/api")) {
        return "https://us-central1-qrgear-c1ffd.cloudfunctions.net/api" + path.slice(4);
      }
    }
  }
  return path;
}

async function getAuthHeader(): Promise<Record<string, string>> {
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
  const authHeader = await getAuthHeader();
  const res = await fetch(getApiUrl(url), {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...authHeader,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeader = await getAuthHeader();
    const url = getApiUrl(queryKey.join("/") as string);
    const res = await fetch(url, {
      credentials: "include",
      headers: authHeader,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
