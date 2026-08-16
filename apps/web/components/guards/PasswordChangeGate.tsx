"use client";

import { usePathname } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { ChangePasswordModal } from "@/components/change-password-modal";

/**
 * Routes that must stay reachable while the flag is set, otherwise a user who
 * never received their generated password has no way to recover: the reset flow
 * lives on /forgot-password and clears the same flag.
 */
const ESCAPE_ROUTES = ["/login", "/forgot-password", "/signup"];

/**
 * Accounts created by an admin sign in with a password that was emailed to them
 * in plaintext. `requireAuth` on the API rejects every route except
 * change-password until that password is replaced, so this renders the dialog
 * over whatever page they landed on rather than letting them meet 403s.
 *
 * The dialog is the enforcement's user-facing half only. Nothing here is load
 * bearing for security; a user who dismisses it by other means still cannot
 * reach any data.
 */
export function PasswordChangeGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mustChangePassword, markPasswordChanged } = useAuth();
  const pathname = usePathname();
  const onEscapeRoute = ESCAPE_ROUTES.some(route =>
    pathname?.startsWith(route)
  );

  return (
    <>
      {children}
      <ChangePasswordModal
        open={mustChangePassword && !onEscapeRoute}
        forced
        onChanged={markPasswordChanged}
        onClose={() => {}}
      />
    </>
  );
}
