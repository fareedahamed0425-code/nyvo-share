/**
 * Nyvo-Share Frontend API Client
 * Resolves the backend service URL dynamically based on environment or deployment host.
 */

export function getApiBaseUrl(): string {
  // 1. Explicit Vite environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, "");
  }

  // 2. Runtime window config if injected
  if (typeof window !== "undefined" && (window as any).__NYVO_API_URL__) {
    return String((window as any).__NYVO_API_URL__).replace(/\/+$/, "");
  }

  // 3. If running in browser on a third-party frontend host (e.g. Vercel, Netlify, GitHub Pages)
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    if (!isLocalhost && !host.includes("onrender.com")) {
      return "https://nyvo-share.onrender.com";
    }
  }

  // 4. Default to same-origin / relative
  return "";
}

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const base = getApiBaseUrl();
  return `${base}${cleanEndpoint}`;
}

export async function apiFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(endpoint);
  return fetch(url, init);
}

export async function apiFetchJson<T = any>(
  endpoint: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const url = apiUrl(endpoint);
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (netErr: any) {
    return {
      ok: false,
      status: 0,
      data: {
        success: false,
        message: `Network error: Could not connect to backend at ${url}. Check your internet connection or backend server status.`,
      } as any,
    };
  }

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;

  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = { success: false, message: "Invalid JSON response returned by backend." };
    }
  } else {
    // Non-JSON response (e.g. 404 HTML page or 502 error page)
    const text = await res.text();
    const cleanSnippet = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    data = {
      success: false,
      message: res.ok
        ? cleanSnippet
        : `Backend returned status ${res.status}: ${cleanSnippet || res.statusText || "Service unavailable"}`,
    };
  }

  return { ok: res.ok, status: res.status, data };
}
