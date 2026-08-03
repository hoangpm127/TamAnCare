"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { AdminAccount } from "@/lib/admin-auth";

type AdminSessionContextValue = {
  session: AdminAccount | null;
  ready: boolean;
  signIn: (account: AdminAccount) => void;
  signOut: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children, initialSession }: { children: React.ReactNode; initialSession: AdminAccount }) {
  const [session, setSession] = useState<AdminAccount | null>(initialSession);
  const ready = true;

  const value = useMemo<AdminSessionContextValue>(
    () => ({
      session,
      ready,
      signIn(account) {
        setSession(account);
      },
      async signOut() {
        await fetch("/api/admin-auth/session", { method: "DELETE" }).catch(() => undefined);
        setSession(null);
      },
    }),
    [ready, session],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const context = useContext(AdminSessionContext);
  if (!context) throw new Error("useAdminSession must be used inside AdminSessionProvider");
  return context;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { session } = useAdminSession();

  if (!session || session.role === "THERAPIST") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf6] px-4 text-[#191414]">
        <div className="flex items-center gap-3 rounded-2xl border border-[#eadbd1] bg-white px-5 py-4 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#eadbd1] border-t-[#9f1d20]" />
          <span className="text-sm font-semibold">Phiên quản trị đã kết thúc…</span>
        </div>
      </main>
    );
  }

  return children;
}
