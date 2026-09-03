"use client";

import { usePathname } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { ChangePasswordModal } from "@/components/change-password-modal";

const ESCAPE_ROUTES = ["/login", "/forgot-password"];

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
      />
    </>
  );
}
