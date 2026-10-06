"use client";

import { ClipboardList } from "lucide-react";
import { useState } from "react";

import { useOrders } from "@/api/queries";
import { statusTone } from "@/components/OrderPanel";
import { Badge, Empty, Spinner } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { clock, itemCount, secondsLeft, statusLabel, tabOf, type OrderTab } from "@/lib/orders";
import { useNow } from "@/lib/use-now";
import { useUi } from "@/store/ui";

const tabs: { value: OrderTab; label: string; empty: string }[] = [
  { value: "new", label: "New", empty: "New orders appear here the moment a customer pays. Keep your store open to receive them." },
  { value: "preparing", label: "Preparing", empty: "Orders you’ve accepted and are cooking or packing." },
  { value: "ready", label: "Ready", empty: "Packed orders waiting for a rider to collect them." },
  { value: "past", label: "Past", empty: "Collected, delivered, rejected and cancelled orders." },
];

export default function OrdersPage() {
  const orders = useOrders();
  const now = useNow();
  const openOrder = useUi((s) => s.openOrder);
  const [tab, setTab] = useState<OrderTab>("new");
  if (orders.isError) return <p className="note note--danger">{orders.error?.message}</p>;
  if (!orders.data) return <Spinner />;

  const count = (t: OrderTab) => orders.data.filter((o) => tabOf(o.status) === t).length;
  const shown = orders.data.filter((o) => tabOf(o.status) === tab);
  const current = tabs.find((t) => t.value === tab)!;

  return (
    <>
      <div className="wrap" role="tablist" aria-label="Order status">
        {tabs.map((t) => {
          const n = t.value === "past" ? 0 : count(t.value);
          return (
            <button key={t.value} type="button" role="tab" className="chip" aria-selected={tab === t.value} onClick={() => setTab(t.value)}>
              {t.label}
              {n > 0 ? <span className={t.value === "new" && tab !== "new" ? "chip__count chip__count--alert" : "chip__count"}>{n}</span> : null}
            </button>
          );
        })}
      </div>

      <section className="card card--flush">
        {shown.length === 0 ? (
          <Empty icon={<ClipboardList />} title={`No ${current.label.toLowerCase()} orders`}>
            {current.empty}
          </Empty>
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
                {shown.map((o) => (
                  <tr key={o.id} className="clickable" data-new={o.status === "new"} onClick={() => openOrder(o.id)}>
                    <td>
                      <button type="button" className="strong" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} aria-label={`Open order ${o.code}`} onClick={() => openOrder(o.id)}>
                        {o.code}
                      </button>
                      {o.customerName && o.customerName !== "Customer" ? <div className="small muted">{o.customerName}</div> : null}
                    </td>
                    <td>
                      <div>{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</div>
                      <div className="small muted">
                        {itemCount(o)} item{itemCount(o) === 1 ? "" : "s"}
                        {o.items.some((i) => i.note) ? " · has a note" : ""}
                      </div>
                    </td>
                    <td>
                      <Badge tone={statusTone(o)}>{o.status === "new" ? `Answer in ${clock(secondsLeft(o.respondBy, now))}` : statusLabel[o.status]}</Badge>
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
