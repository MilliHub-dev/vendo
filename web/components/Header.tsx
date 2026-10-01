"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { nav, whatsappLink } from "@/lib/site";
import { Art } from "./Art";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));

  return (
    <header className="header">
      <div className="container">
        <div className="header__bar">
          <Link href="/" className="header__logo" aria-label="Vendo home">
            <Art src="/brand/logo-blue.png" darkSrc="/brand/logo-white.png" alt="Vendo" width={148} height={36} />
          </Link>
          <nav className="header__nav" aria-label="Main">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
          <div className="header__actions">
            <Link href="/download/" className="btn btn--light">
              Get the app
            </Link>
            <a href={whatsappLink("Hi Vendo, I'd like to book a delivery.")} className="btn btn--dark" target="_blank" rel="noopener">
              Book Now <ArrowRight className="arrow" />
            </a>
          </div>
          <button
            className="header__toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <nav className="mobile-menu" aria-label="Mobile">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
            <Link href="/download/">Get the app</Link>
            <a href={whatsappLink("Hi Vendo, I'd like to book a delivery.")} className="btn btn--primary btn--block" target="_blank" rel="noopener">
              Book Now <ArrowRight className="arrow" />
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
