export const AUTH_SESSION_EXPIRED_EVENT = "ralli-wolf:auth-session-expired";

export function announceExpiredSession(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
}
