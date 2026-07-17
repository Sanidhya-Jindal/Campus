import { API_BASE } from "./api";

// Access tokens live 15 minutes. Without this, every page silently 401s once
// that elapses ("No entities found", "Occupancy unavailable (401)").

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
    const refresh = localStorage.getItem("refresh");
    if (!refresh) return null;
    try {
        const res = await fetch(`${API_BASE}/users/token/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh }),
        });
        if (!res.ok) {
            // Refresh itself expired (7 days) or was blacklisted — force re-login.
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            return null;
        }
        const data = await res.json();
        if (data.access) localStorage.setItem("access", data.access);
        // ROTATE_REFRESH_TOKENS is on, so a new refresh comes back too.
        if (data.refresh) localStorage.setItem("refresh", data.refresh);
        return data.access ?? null;
    } catch {
        return null;
    }
}

/** Serialises concurrent refreshes so a page with several calls only refreshes once. */
function getFreshAccess(): Promise<string | null> {
    if (!refreshing) {
        refreshing = refreshAccess().finally(() => {
            refreshing = null;
        });
    }
    return refreshing;
}

/**
 * fetch() with the bearer token attached, retrying once through a token
 * refresh if the server rejects it.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const withAuth = (token: string | null): RequestInit => ({
        ...init,
        headers: {
            ...(init.headers as Record<string, string> | undefined),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    const res = await fetch(input, withAuth(localStorage.getItem("access")));
    if (res.status !== 401) return res;

    const fresh = await getFreshAccess();
    if (!fresh) return res; // caller surfaces the 401; user must sign in again
    return fetch(input, withAuth(fresh));
}
