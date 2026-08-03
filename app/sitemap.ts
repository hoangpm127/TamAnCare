import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/booking", changeFrequency: "daily", priority: 0.9 },
  { path: "/ktv", changeFrequency: "weekly", priority: 0.8 },
  { path: "/uu-dai", changeFrequency: "weekly", priority: 0.8 },
  { path: "/lien-he", changeFrequency: "monthly", priority: 0.7 },
  { path: "/doanh-nghiep", changeFrequency: "monthly", priority: 0.7 },
  { path: "/dieu-khoan", changeFrequency: "monthly", priority: 0.4 },
  { path: "/chinh-sach-rieng-tu", changeFrequency: "monthly", priority: 0.4 },
  { path: "/chinh-sach-dat-lich", changeFrequency: "monthly", priority: 0.4 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl().origin;
  return PUBLIC_ROUTES.map((route) => ({
    url: `${origin}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
