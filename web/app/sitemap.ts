import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";

const pages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/join/", priority: 0.9, changeFrequency: "monthly" },
  { path: "/about/", priority: 0.8, changeFrequency: "monthly" },
  { path: "/contact/", priority: 0.8, changeFrequency: "yearly" },
  { path: "/download/", priority: 0.7, changeFrequency: "monthly" },
  { path: "/careers/", priority: 0.6, changeFrequency: "monthly" },
  { path: "/terms/", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy/", priority: 0.3, changeFrequency: "yearly" },
  { path: "/licenses/", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return pages.map((p) => ({ url: `${site.url}${p.path}`, lastModified, changeFrequency: p.changeFrequency, priority: p.priority }));
}
