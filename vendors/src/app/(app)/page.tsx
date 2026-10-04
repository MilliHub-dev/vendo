"use client";

import { ArrowRight, BellRing } from "lucide-react";
import Link from "next/link";

import { useDashboard, useMenu, useOrders, useSetOpen, useStore } from "@/api/queries";
import { statusTone } from "@/components/OrderPanel";
import { Badge, Spinner, Switch } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { statusLabel } from "@/lib/orders";
import { useUi } from "@/store/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const short = (kobo: number) => (kobo >= 100_000 ? `₦${Math.round(kobo / 100_000)}k` : kobo ? formatNaira(kobo) : "");

export default function DashboardPage() {
  const store = useStore();
  const dashboard = useDashboard();
  const orders = useOrders();
  const menu = useMenu();
  const setOpen = useSetOpen();
  const openOrder = useUi((s) => s.openOrder);
  const s = store.data;
  const d = dashboard.data;
  if (!s || !d) return <Spinner />;

  const open = s.isOpen;
  const waiting = orders.data?.filter((o) => o.status === "new") ?? [];
  const inKitchen = orders.data?.filter((o) => o.status === "preparing").length ?? 0;
  const max = Math.max(1, ...d.days.map((x) => x.salesKobo));
  const recent = orders.data?.slice(0, 6) ?? [];

  return (
    <>
      <section className="hero-status" data-open={open}>
        <div className="grow">
          <h2>{open ? `${s.name} is open for orders` : `${s.name} is closed`}</h2>
          <p className="muted">{open ? "Customers can order from you now. Keep this page open to hear new orders." : "Customers can’t order until you open. Switch on when you’re ready to cook."}</p>
        </div>
        <Switch checked={open} disabled={setOpen.isPending} onChange={(next) => setOpen.mutate(next)} label={open ? "Close store" : "Open store"} />
      </section>

      {menu.data?.length === 0 ? (
        <Link href="/menu/" className="note between" style={{ border: "1.5px solid var(--blue)" }}>
          <span>
            <strong className="strong">Add your menu to start selling.</strong> You need at least one item before you can open.
          </span>
          <ArrowRight size={18} color="var(--blue)" />
        </Link>
      ) : null}

      {waiting.length > 0 || inKitchen > 0 ? (
        <Link href="/orders/" className="note between" style={{ border: `1.5px solid ${waiting.length ? "var(--danger)" : "var(--blue)"}`, background: "var(--surface)" }}>
          <span className="row">
            <BellRing size={18} color={waiting.length ? "var(--danger)" : "var(--blue)"} />
            <span>
              <strong className="strong">{waiting.length ? `${waiting.length} new order${waiting.length === 1 ? "" : "s"} waiting for you.` : `${inKitchen} order${inKitchen === 1 ? "" : "s"} being prepared.`}</strong>{" "}
              {waiting.length ? "Accept or reject before the timer runs out." : "Mark each one ready when it’s packed."}
            </span>
          </span>
          <ArrowRight size={18} />
        </Link>
      ) : null}

      <section className="stats" aria-label="Today">
        <div className="card stat">
          <span className="stat__label">Orders today</span>
          <span className="stat__value">{d.today.orders}</span>
        </div>
        <div className="card stat">
          <span className="stat__label">Sales today</span>
          <span className="stat__value">{formatNaira(d.today.salesKobo)}</span>
        </div>
        <div className="card stat">
          <span className="stat__label">You receive today</span>
          <span className="stat__value stat__value--accent">{formatNaira(d.today.payoutKobo)}</span>
        </div>
        <div className="card stat">
          <span className="stat__label">Rating</span>
          <span className="stat__value">{s.ratingCount ? `${s.rating.toFixed(1)} ★` : "New"}</span>
          <span className="small muted">{s.ratingCount ? `${s.ratingCount} ratings` : "No ratings yet"}</span>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card__head">
            <h2>Sales, last 7 days</h2>
            <span className="small strong text-primary">
              {formatNaira(d.week.salesKobo)} · {d.week.orders} orders
            </span>
          </div>
          <div className="chart" role="img" aria-label={`Sales for the last 7 days: ${d.days.map((x) => `${DAYS[new Date(x.date).getDay()]} ${formatNaira(x.salesKobo)}`).join(", ")}`}>
            {d.days.map((x, i) => (
              <div key={x.date} className="chart__col" data-today={i === d.days.length - 1} title={`${formatNaira(x.salesKobo)} · ${x.orders} orders`}>
                <span>{short(x.salesKobo)}</span>
                <div className="chart__bar" style={{ height: Math.max(4, Math.round((x.salesKobo / max) * 130)) }} />
                <span className="chart__day">{DAYS[new Date(x.date).getDay()]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h2>Best sellers this week</h2>
            <Link href="/menu/" className="small strong text-primary">
              Menu
            </Link>
          </div>
          {d.topItems.length === 0 ? <p className="muted">Your most-ordered items will show here once orders come in.</p> : null}
          <div className="list">
            {d.topItems.map((item, i) => (
              <div key={item.name} className="list__row">
                <span className="rank">{i + 1}</span>
                <span className="grow truncate">{item.name}</span>
                <span className="small muted">{item.quantity} sold</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card card--flush">
        <div className="card__head" style={{ padding: "18px 20px 0" }}>
          <h2>Recent orders</h2>
          <Link href="/orders/" className="small strong text-primary">
            All orders
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted" style={{ padding: "0 20px 20px" }}>
            No orders yet. Open your store to start receiving them.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Placed</th>
                  <th className="num">You receive</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="clickable" data-new={o.status === "new"} onClick={() => openOrder(o.id)}>
                    <td>
                      <button type="button" className="strong" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => openOrder(o.id)}>
                        {o.code}
                      </button>
                      <div className="small muted">{o.customerName}</div>
                    </td>
                    <td className="muted">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</td>
                    <td>
                      <Badge tone={statusTone(o)}>{statusLabel[o.status]}</Badge>
                    </td>
                    <td className="muted" data-label="Placed">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="num strong" data-label="You receive">
                      {formatNaira(o.payoutKobo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
