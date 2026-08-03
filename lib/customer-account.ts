"use client";

import { useEffect, useState } from "react";

export type CustomerAccountView = {
  customerId: string;
  fullName: string;
  phone: string;
  phoneVerified: boolean;
  totalVisits: number;
  creditBalance: number;
  welcomeCreditAvailable: boolean;
  oauthProviders: Array<"GOOGLE" | "FACEBOOK">;
};

export function useCustomerAccount() {
  const [account, setAccount] = useState<CustomerAccountView | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/customer-auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (active) setAccount(data.account ?? null); })
      .catch(() => { if (active) setAccount(null); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  return { account, ready };
}
