import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Robust JSON/Text error reader.
 * Works even if server sends HTML (Render / Vite fallback).
 */
async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(`${res.status}: ${body}`);
  }
}

/**
 * IMPORTANT:
 * - Always use relative API paths like "/api/login"
 * - Do NOT build absolute URLs with new URL() in the browser -> iOS can throw "Invalid URL"
 */
function normalizePath(url: string) {
  if (!url) return "/";

  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (!url.startsWith("/")) return `/${url}`;
  return url;
}

/** ✅ Token aus localStorage holen (passt für token oder accessToken) */
function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.token || u?.accessToken || null;
  } catch {
    return null;
  }
}

/** ✅ Authorization Header bauen */
function withAuthHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAuthToken();
  const base: Record<string, string> = {};

  if (token) base["Authorization"] = `Bearer ${token}`;

  // extra kann object / array / Headers sein -> wir mergen sauber
  if (!extra) return base;

  // Wenn extra schon ein plain object ist
  if (typeof extra === "object" && !(extra instanceof Headers) && !Array.isArray(extra)) {
    return { ...base, ...(extra as Record<string, string>) };
  }

  // Falls Headers oder Array-Tuples:
  const h = new Headers(extra);
  Object.entries(base).forEach(([k, v]) => h.set(k, v));
  return h;
}

/**
 * Generic request (kept for existing code).
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const safeUrl = normalizePath(url);

  const headers: HeadersInit = data
    ? withAuthHeaders({ "Content-Type": "application/json" })
    : withAuthHeaders();

  const res = await fetch(safeUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    // Wenn du Sessions NICHT mehr brauchst, kannst du credentials entfernen.
    // Aber lassen wir es erstmal drin – schadet nicht.
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * ✅ postJson: Returns parsed JSON and throws clean errors.
 */
export async function postJson<TResponse = any>(
  url: string,
  data?: unknown,
  init?: RequestInit
): Promise<TResponse> {
  const safeUrl = normalizePath(url);

  const res = await fetch(safeUrl, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    }),
    body: data !== undefined ? JSON.stringify(data) : undefined,
    credentials: "include",
    ...init,
  });

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(`${res.status}: ${body}`);
  }

  const txt = await res.text();
  if (!txt) return {} as TResponse;

  try {
    return JSON.parse(txt) as TResponse;
  } catch {
    return { raw: txt } as any;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = normalizePath(queryKey[0] as string);

    const res = await fetch(url, {
      credentials: "include",
      headers: withAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as any;
    }

    await throwIfResNotOk(res);

    const txt = await res.text();
    if (!txt) return {} as T;

    return JSON.parse(txt) as T;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
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
