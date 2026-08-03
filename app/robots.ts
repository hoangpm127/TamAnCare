import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const origin = siteUrl().origin;
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/booking", "/ktv", "/uu-dai", "/lien-he", "/doanh-nghiep"],
      disallow: [
        "/api/",
        "/admin/",
        "/xgroup/",
        "/therapist/",
        "/tai-khoan",
        "/don-cua-toi",
        "/thanh-toan/",
        "/check-in",
        "/office/",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
