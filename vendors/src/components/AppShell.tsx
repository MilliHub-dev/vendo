"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Bell, ClipboardList, LayoutDashboard, LogOut, Settings, Star, UtensilsCrossed, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { api } from "@/api/client";
import { useNotifications, useOrders, useSetOpen, useStore } from "@/api/queries";
import { dayLabel } from "@/lib/dates";
import { stageOf, useSession } from "@/store/session";

import { Logo } from "./Logo";
import { OrderAlert } from "./OrderAlert";
import { OrderPanel } from "./OrderPanel";
import { ThemeToggle } from "./ThemeToggle";
import { Confirm, Spinner, Switch } from "./ui";

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders/", label: "Orders", icon: ClipboardList },
  { href: "/menu/", label: "Menu", icon: UtensilsCrossed },
  { href: "/payouts/", label: "Payouts", icon: Banknote },
  { href: "/reviews/", label: "Reviews", icon: Star },
  { href: "/store/", label: "Store settings", icon: Settings },
];
const titles: Record<string, string> = { "/": "Dashboard", "/orders": "Orders", "/menu": "Menu", "/payouts": "Payouts", "/reviews": "Reviews", "/store": "Store settings" };

/** Sends the visitor to the right place for their stage and returns true once this page may render. */
export function useGate(wanted: "signed_out" | "registering" | "working") {
  const router = useRouter();
  const session = useSession();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []); // the saved session lives in localStorage, so wait for the browser
  const stage = stageOf(session);
  useEffect(() => {
    if (!hydrated || stage === wanted) return;
    router.replace(stage === "signed_out" ? "/login/" : stage === "registering" ? "/register/" : "/");
  }, [hydrated, stage, wanted, router]);
  return hydrated && stage === wanted;
}

/** Mirrors the store from the API into the saved session, so an approval moves the vendor on by itself. */
export function useStoreSync(enabled: boolean) {
  const setStore = useSession((s) => s.setStore);
  const { data } = useStore(enabled);
  useEffect(() => {
    if (enabled && data !== undefined) setStore(data);
  }, [enabled, data, setStore]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const ok = useGate("working");
  useStoreSync(ok);
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const queryClient = useQueryClient();
  const { user, signOut } = useSession();
  const store = useStore(ok);
  const orders = useOrders(ok);
  const stores = useQuery({queryKey:["stores"],queryFn:()=>api.listStores(),enabled:ok});
  const setOpen = useSetOpen();
  const [loggingOut, setLoggingOut] = useState(false);
  const [bell, setBell] = useState(false);

  if (!ok) return <Spinner />;
  if (store.isError) return <p className="note note--danger">{store.error.message}</p>;

  const waiting = orders.data?.filter((o) => o.status === "new").length ?? 0;
  const open = !!store.data?.isOpen;
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));
  const links = (compact: boolean) =>
    nav
      .filter((n) => !compact || n.href !== "/reviews/")
      .map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined}>
          <Icon />
          <span>{compact ? label.replace("Store settings", "Store") : label}</span>
          {href === "/orders/" && waiting > 0 ? <span className="nav__badge">{waiting > 9 ? "9+" : waiting}</span> : null}
        </Link>
      ));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <span className="brand__tag">VENDOR</span>
        </div>
        <nav className="nav" aria-label="Main">
          {links(false)}
        </nav>
        <div className="sidebar__foot">
          <div className="row">
            <div className="avatar">{store.data?.logoUrl ? <img src={store.data.logoUrl} alt="" /> : user?.name.slice(0, 1)}</div>
            <div className="grow">
              <div className="strong truncate">{user?.name}</div>
              <div className="small muted truncate">{store.data?.name}</div>
            </div>
          </div>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setLoggingOut(true)}>
            <LogOut /> Log out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="grow truncate">{titles[pathname] ?? "Vendo Vendor"}</h1>
          <div className="open-pill" data-open={open}>
            <span className={open ? "dot dot--on" : "dot"} />
            <span>{open ? "Open for orders" : "Closed"}</span>
            <Switch checked={open} disabled={setOpen.isPending} onChange={(next) => setOpen.mutate(next)} label={open ? "Close store" : "Open store"} />
          </div>
          {stores.data && stores.data.length > 1 ? <select aria-label="Select store" className="select" value={store.data?.id ?? ""} onChange={e=>{const selected=stores.data?.find(s=>s.id===e.target.value);if(selected){queryClient.clear();useSession.getState().setStore(selected);}}}>{stores.data.filter(s=>s.approval==="approved").map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select> : null}
          <ThemeToggle />
          <div style={{ position: "relative" }}>
            <button type="button" className="icon-btn" aria-label="Notifications" aria-expanded={bell} onClick={() => setBell((v) => !v)}>
              <Bell />
            </button>
            {bell ? <Notifications onClose={() => setBell(false)} /> : null}
          </div>
          <button type="button" className="icon-btn topbar__logout" aria-label="Log out" onClick={() => setLoggingOut(true)}>
            <LogOut />
          </button>
        </header>
        {setOpen.isError ? (
          <div className="page" style={{ paddingBottom: 0 }}>
            <p className="note note--danger">{setOpen.error.message}</p>
          </div>
        ) : null}
        <main className="page">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {links(true)}
      </nav>

      <OrderAlert />
      <OrderPanel />
      {loggingOut ? (
        <Confirm
          title="Log out?"
          message="You won’t see new orders on this device until you sign in again. Close your store first if nobody else is watching for orders."
          confirmLabel="Log out"
          danger
          onClose={() => setLoggingOut(false)}
          onConfirm={() => {
            queryClient.clear();
            void api.logout().catch(() => {});
            signOut();
          }}
        />
      ) : null}
    </div>
  );
}

function Notifications({ onClose }: { onClose: () => void }) {
  const { data } = useNotifications();
  useEffect(() => {
    const close = (e: MouseEvent) => !(e.target as HTMLElement).closest(".popover, [aria-label='Notifications']") && onClose();
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);
  return (
    <div className="popover" role="dialog" aria-label="Notifications">
      {!data ? <p className="popover__item muted">Loading…</p> : null}
      {data?.map((n) => (
        <div key={n.id} className="popover__item">
          <div className="strong">{n.title}</div>
          <div className="small muted">{n.body}</div>
          <div className="small subtle">{dayLabel(new Date(n.createdAt))}</div>
        </div>
      ))}
    </div>
  );
}
