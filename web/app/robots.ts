import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";

// Open to all search engines and to AI assistants' search/answer crawlers, so Vendo can
// be found and cited in ChatGPT, Claude, Perplexity, Gemini and Copilot answers.
// To opt out of AI *model training* only, move "GPTBot", "ClaudeBot", "Google-Extended",
// "Applebot-Extended" and "CCBot" into a { userAgent: [...], disallow: "/" } rule.
const aiCrawlers = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "DuckAssistBot",
  "Meta-ExternalAgent",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: aiCrawlers, allow: "/" },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
