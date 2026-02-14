function headersToRecord(init: HeadersInit | undefined): Record<string, string> {
  if (!init) return {};
  if (init instanceof Headers) {
    const record: Record<string, string> = {};
    init.forEach((value, key) => { record[key] = value; });
    return record;
  }
  if (Array.isArray(init)) {
    const record: Record<string, string> = {};
    for (const [key, value] of init) {
      record[key] = value;
    }
    return record;
  }
  return { ...init } as Record<string, string>;
}

export async function authFetch(
  url: string,
  getAuthHeaders: () => Promise<HeadersInit>,
  options: RequestInit = {}
) {
  const authHeaders = await getAuthHeaders();

  const mergedHeaders: Record<string, string> = {
    ...headersToRecord(options.headers as HeadersInit | undefined),
    ...headersToRecord(authHeaders),
  };

  if (options.body && !mergedHeaders["Content-Type"]) {
    mergedHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...options,
    headers: mergedHeaders,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${text}`);
  }

  return res;
}
