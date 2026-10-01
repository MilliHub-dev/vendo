"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Blocks that fade up as they scroll into view. Siblings get a small stagger.
const SELECTOR = [
  ".section-head",
  ".split__intro",
  ".card",
  ".feature",
  ".step",
  ".plan",
  ".track > *",
  ".app-block > *",
  ".pricing > div:first-child",
  ".cta",
  ".cities-strip",
  ".bike-card",
  ".mv",
  ".team-row",
  ".contact-card",
  ".qr-card",
  ".panel",
  ".app-card",
  ".two-col > *",
  ".join-block__grid > *",
  ".tier",
  ".legal__toc",
  ".prose > section",
].join(",");

/**
 * Progressive enhancement: content is visible by default. Only elements that start
 * below the fold get the hidden `.reveal` state, so nothing flashes and nothing is
 * lost without JS or with reduced motion.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pending = new Set<HTMLElement>();

    function reveal(el: HTMLElement) {
      if (!pending.delete(el)) return;
      io.unobserve(el);
      el.classList.add("is-visible");
      // drop the classes afterwards so hover transitions aren't delayed
      const delay = parseInt(el.style.getPropertyValue("--reveal-delay")) || 0;
      window.setTimeout(() => {
        el.classList.remove("reveal", "is-visible");
        el.style.removeProperty("--reveal-delay");
      }, 800 + delay);
    }

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && reveal(e.target as HTMLElement)),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );

    // The observer never fires for blocks the visitor skips right past (anchor links,
    // "End" key, fast flicks), so also release anything that is now above the fold.
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const el of pending) if (el.getBoundingClientRect().top < window.innerHeight) reveal(el);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const els = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter(
      (el) => !el.closest(".hero, .page-hero") && !el.parentElement?.closest(SELECTOR),
    );
    for (const el of els) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) continue; // already on screen
      const siblings = Array.from(el.parentElement?.children ?? []).filter((c) => c.matches(SELECTOR));
      el.style.setProperty("--reveal-delay", `${Math.min(siblings.indexOf(el), 5) * 90}ms`);
      el.classList.add("reveal");
      pending.add(el);
      io.observe(el);
    }
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
