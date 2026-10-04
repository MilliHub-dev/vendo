"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Banknote, Bell, Bike, ClipboardList, History, LayoutDashboard, LogOut, MapPin, Megaphone, Menu, Store, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useOverview } from "@/api/queries";
import type { Overview } from "@/api/types";
import { can, roleLabel, type Permission } from "@/lib/permissions";
import { useSession } from "@/store/session";

import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Confirm, Spinner } from "./ui";

type NavItem = { href: string; label: string; icon: LucideIcon; needs?: Permission; badge?: (q: Overview["queues"]) => number };
const nav: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/orders/", label: "Orders", icon: ClipboardList, badge: (q) => q.disputes },
  { href: "/riders/", label: "Riders", icon: Bike, badge: (q) => q.riderApprovals },
  { href: "/vendors/", label: "Vendors", icon: Store, badge: (q) => q.vendorApprovals },
  { href: "/customers/", label: "Customers", icon: Users },
  { href: "/payments/", label: "Payments", icon: Banknote, badge: (q) => q.withdrawals },
  { href: "/cities/", label: "Cities & pricing", icon: MapPin },
  { href: "/promotions/", label: "Promotions", icon: Megaphone },
  { href: "/notifications/", label: "Notifications", icon: Bell },
  { href: "/analytics/", label: "Analytics", icon: BarChart3 },
  { href: "/audit/", label: "Audit log", icon: History, needs: "audit.view" },
];

/** Sends the visitor to login (or into the app) and returns true once this page may render. */
export function useGate(wanted: "signed_out" | "signed_in") {
  const router = useRouter();
  const admin = useSession((s) => s.admin);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []); // the saved session lives in localStorage, so wait for the browser
  const stage = admin ? "signed_in" : "signed_out";
  useEffect(() => {
    if (hydrated && stage !== wanted) router.replace(stage === "signed_out" ? "/login/" : "/");
  }, [hydrated, stage, wanted, router]);
  return hydrated && stage === wanted;
}

export function AppShell({ children }: { children: ReactNode }) {
  const ok = useGate("signed_in");
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const queryClient = useQueryClient();
  const { admin, signOut } = useSession();
  const overview = useOverview();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menu, setMenu] = useState(false);

  if (!ok || !admin) return <Spinner />;

  const items = nav.filter((n) => !n.needs || can(admin.role, n.needs));
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));
  const title = nav.find((n) => isCurrent(n.href))?.label ?? "Vendo Admin";

  return (
    <div className="shell" data-menu={menu ? "open" : undefined}>
      {menu ? <div className="shell__scrim" onClick={() => setMenu(false)} /> : null}
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <span className="brand__tag">ADMIN</span>
        </div>
        <nav className="nav" aria-label="Main">
          {items.map(({ href, label, icon: Icon, badge }) => {
            const count = overview.data && badge ? badge(overview.data.queues) : 0;
            return (
              <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined} onClick={() => setMenu(false)}>
                <Icon />
                <span>{label}</span>
                {count > 0 ? <span className="nav__badge">{count > 9 ? "9+" : count}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar__foot">
          <div className="row">
            <div className="avatar">{admin.name.slice(0, 1)}</div>
            <div className="grow">
              <div className="strong truncate">{admin.name}</div>
              <div className="small muted truncate">{roleLabel[admin.role]}</div>
            </div>
          </div>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setLoggingOut(true)}>
            <LogOut /> Log out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn topbar__menu" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <h1 className="grow truncate">{title}</h1>
          <span className="badge badge--primary">{roleLabel[admin.role]}</span>
          <ThemeToggle />
        </header>
        <main className="page">{children}</main>
      </div>

      {loggingOut ? (
        <Confirm
          title="Log out?"
          message="You’ll need your email and password to sign in again."
          confirmLabel="Log out"
          danger
          onClose={() => setLoggingOut(false)}
          onConfirm={() => {
            queryClient.clear();
            signOut();
          }}
        />
      ) : null}
    </div>
  );
}
