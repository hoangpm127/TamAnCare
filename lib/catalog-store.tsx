"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { PublicCatalog } from "@/lib/catalog-types";

const PublicCatalogContext = createContext<PublicCatalog | null>(null);

export function PublicCatalogProvider({
  children,
  initialCatalog,
}: {
  children: React.ReactNode;
  initialCatalog: PublicCatalog;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        if (!response.ok) throw new Error("Không thể tải danh mục vận hành.");
        const nextCatalog = await response.json() as PublicCatalog;
        if (active) setCatalog(nextCatalog);
      } catch {
        // Giữ snapshot dữ liệu thật được render từ server khi mạng chập chờn.
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return <PublicCatalogContext.Provider value={catalog}>{children}</PublicCatalogContext.Provider>;
}

export function usePublicCatalog() {
  const catalog = useContext(PublicCatalogContext);
  if (!catalog) throw new Error("usePublicCatalog phải được dùng bên trong PublicCatalogProvider.");
  return catalog;
}
