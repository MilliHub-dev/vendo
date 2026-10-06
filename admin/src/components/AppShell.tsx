"use client";

import { BarChart3, Banknote, Bell, Bike, ClipboardList, History, LayoutDashboard, LifeBuoy, LogOut, MapPin, Megaphone, Menu, Store, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api, request } from "@/api/client";
import type { Row } from "@/api/types";
import { useSession } from "@/store/session";

import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button, Confirm, Spinner } from "./ui";

/** Sends the visitor to login (or into the app) and returns true once this page may render. */
export function useGate(wanted: "signed_out" | "signed_in") {
  const router = useRouter();
  const admin = useSession((s) => s.admin);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []); // the saved session lives in the browser, so wait for it
  const stage = admin ? "signed_in" : "signed_out";
  useEffect(() => {
    if (ready && stage !== wanted) router.replace(stage === "signed_out" ? "/login/" : "/");
  }, [ready, stage, wanted, router]);
  return ready && stage === wanted;
}

/** `queue` names the overview count shown as a badge: work waiting on that page. */
const nav: { href: string; label: string; icon: LucideIcon; queue?: string }[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/orders/", label: "Orders", icon: ClipboardList, queue: "disputes" },
  { href: "/riders/", label: "Riders", icon: Bike, queue: "rider_applications" },
  { href: "/vendors/", label: "Vendors", icon: Store, queue: "vendor_applications" },
  { href: "/customers/", label: "Customers", icon: Users },
  { href: "/payments/", label: "Payments", icon: Banknote, queue: "withdrawals" },
  { href: "/cities/", label: "Cities & pricing", icon: MapPin },
  { href: "/promotions/", label: "Promotions", icon: Megaphone },
  { href: "/notifications/", label: "Notifications", icon: Bell },
  { href: "/analytics/", label: "Analytics", icon: BarChart3 },
  { href: "/support/", label: "Support", icon: LifeBuoy },
  { href: "/audit/", label: "Audit log", icon: History },
];

export function AppShell({ children }: { children: ReactNode }) {
  const ok = useGate("signed_in");
  const pathname = usePathname();
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const admin = useSession((s) => s.admin);
  const client = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const me = useQuery({ queryKey: ["admin-me"], queryFn: api.me, enabled: ok, refetchInterval: 30000, retry: false });
  // the same query the Overview page uses, so the sidebar badges cost nothing extra there
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => request<{ queues: Row }>("/v1/admin/portal/overview"), enabled: ok && !!me.data, refetchInterval: 30000 });
  useEffect(() => {
    if (me.data) useSession.getState().signIn(me.data);
  }, [me.data]);
  useEffect(() => {
    // the page behind the open menu shouldn't scroll on phones
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  if (!ok || !admin) return <Spinner />;
  const current = nav.find((item) => (item.href === "/" ? path === "/" : path.startsWith(item.href)));
  const name = admin.name ?? admin.email ?? "Admin";

  return (
    <div className="shell" data-menu={menu ? "open" : undefined}>
      {menu ? <div className="shell__scrim" onClick={() => setMenu(false)} /> : null}
      <aside className="sidebar" aria-label="Sections">
        <div className="brand">
          <Logo />
          <span className="brand__tag">ADMIN</span>
          <button type="button" className="icon-btn sidebar__close" aria-label="Close menu" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <nav className="nav">
          {nav.map(({ href, label, icon: Icon, queue }) => {
            const waiting = queue ? Number(overview.data?.queues?.[queue] ?? 0) : 0;
            return (
              <Link key={href} href={waiting > 0 && queue === "vendor_applications" ? `${href}?tab=applications` : href} aria-current={current?.href === href ? "page" : undefined} onClick={() => setMenu(false)}>
                <Icon />
                <span>{label}</span>
                {waiting > 0 ? <span className="nav__badge">{waiting > 99 ? "99+" : waiting}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar__foot">
          <div className="row">
            <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="strong truncate">{name}</div>
              <div className="small muted truncate">{admin.name ? admin.email : "Administrator"}</div>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setLoggingOut(true)}>
            <LogOut /> Log out
          </Button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn topbar__menu" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <h1 className="grow truncate">{current?.label ?? "Vendo Admin"}</h1>
          <ThemeToggle />
        </header>
        <main className="page">
          {logoutError ? (
            <p role="alert" className="note note--warning">
              {logoutError}
            </p>
          ) : null}
          {me.isError ? (
            <div className="card stack">
              <p role="alert" className="text-danger">
                {me.error.message}
              </p>
              <div>
                <Button onClick={() => me.refetch()}>Check access again</Button>
              </div>
            </div>
          ) : !me.data ? (
            <Spinner />
          ) : (
            children
          )}
        </main>
      </div>

      {loggingOut ? (
        <Confirm
          title="Log out?"
          message="You’ll need a new code from your email to sign in again."
          confirmLabel="Log out"
          danger
          onClose={() => setLoggingOut(false)}
          onConfirm={async () => {
            setLoggingOut(false);
            try {
              await api.logout();
            } catch {
              setLogoutError("You are signed out on this device, but the server could not confirm it.");
            } finally {
              client.clear();
            }
          }}
        />
      ) : null}
    </div>
  );
}
