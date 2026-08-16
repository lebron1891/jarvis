"use client";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ACCESS_KEY = "skillswap.access";
const REFRESH_KEY = "skillswap.refresh";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get access() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = tokenStore.refresh;
      if (!refresh) return false;
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        tokenStore.set(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshPromise = null), 0);
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

/** JSON API client with transparent access-token refresh. */
export async function api<T = unknown>(
  path: string,
  opts: RequestOptions = {},
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  const access = tokenStore.access;
  if (access) headers.Authorization = `Bearer ${access}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? (opts.body !== undefined || opts.formData ? "POST" : "GET"),
    headers,
    body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    signal: opts.signal,
  });

  if (res.status === 401 && !retried && tokenStore.refresh) {
    const ok = await tryRefresh();
    if (ok) return api<T>(path, opts, true);
    tokenStore.clear();
  }

  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const data = await res.json();
      message = data?.error?.message ?? message;
      code = data?.error?.code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiRequestError(res.status, message, code);
  }
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body ?? {} });
export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body });
export const apiPut = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return api<{ url: string; fileName: string; size: number; mimeType: string }>(
    "/api/uploads",
    { formData },
  );
}
