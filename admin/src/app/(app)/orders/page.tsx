"use client";

import { ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/api/client";
import { useAction, useOrders, useRiders } from "@/api/queries";
import type { Order, OrderGroup } from "@/api/types";
import { ActionModal, CitySelect, ExportButton, KV, Locked, OrderBadge, SearchBox, Tabs, useCan, useCityName } from "@/components/admin";
import { Button, Empty, Modal, Spinner } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { orderGroup, orderStatusLabel } from "@/lib/permissions";

type Tab = OrderGroup | "all";
const groups: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "disputed", label: "Disputed" },
];
const PAGE = 25;

export default function OrdersPage() {
  const { data } = useOrders();
  const cityName = useCityName();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  // links from the overview: /orders/?group=disputed and /orders/?open=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const group = params.get("group");
    if (group && groups.some((g) => g.value === group)) setTab(group as Tab);
    if (params.get("open")) setOpenId(params.get("open"));
  }, []);

  if (!data) return <Spinner />;

  const q = query.trim().toLowerCase();
  const filtered = data.filter((o) => (!city || o.cityId === city) && (!type || o.type === type) && (!q || [o.code, o.customer.name, o.customer.phone, o.vendorName, o.riderName].some((v) => v?.toLowerCase().includes(q))));
  const rows = filtered.filter((o) => tab === "all" || orderGroup(o.status) === tab);
  const count = (g: Tab) => (g === "all" ? 0 : filtered.filter((o) => orderGroup(o.status) === g).length);
  const open = data.find((o) => o.id === openId);

  return (
    <>
      <Tabs label="Order status" value={tab} onChange={(v) => (setTab(v), setShown(PAGE))} tabs={groups.map((g) => ({ ...g, count: ["pending", "active", "disputed"].includes(g.value) ? count(g.value) : undefined, alert: g.value === "disputed" }))} />
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search order code, customer, vendor or rider" />
        <CitySelect value={city} onChange={setCity} />
        <select className="select select--inline" aria-label="Order type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Food and dispatch</option>
          <option value="food">Food only</option>
          <option value="dispatch">Dispatch only</option>
        </select>
        <span className="grow" />
        <ExportButton
          rows={rows}
          filename="vendo-orders.csv"
          columns={[
            ["Order", (o) => o.code],
            ["Type", (o) => o.type],
            ["Status", (o) => orderStatusLabel[o.status]],
            ["City", (o) => cityName(o.cityId)],
            ["Customer", (o) => o.customer.name],
            ["Vendor", (o) => o.vendorName ?? ""],
            ["Rider", (o) => o.riderName ?? ""],
            ["Total (NGN)", (o) => o.totalKobo / 100],
            ["Commission (NGN)", (o) => o.commissionKobo / 100],
            ["Refunded (NGN)", (o) => o.refundedKobo / 100],
            ["Placed", (o) => o.createdAt],
          ]}
        />
      </div>

      <section className="card card--flush">
        {rows.length === 0 ? (
          <Empty icon={<ClipboardList />} title="No orders match">
            Try a different status, city or search.
          </Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Status</th>
                    <th>From</th>
                    <th>City</th>
                    <th>Rider</th>
                    <th>Placed</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, shown).map((o) => (
                    <tr key={o.id} className="clickable" data-alert={o.status === "disputed"} onClick={() => setOpenId(o.id)}>
                      <td>
                        <button type="button" className="strong" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} aria-label={`Open order ${o.code}`}>
                          {o.code}
                        </button>
                        <div className="small muted">{o.customer.name}</div>
                      </td>
                      <td>
                        <OrderBadge status={o.status} />
                      </td>
                      <td data-label="From">{o.type === "food" ? o.vendorName : <span className="muted">Dispatch</span>}</td>
                      <td data-label="City">{cityName(o.cityId)}</td>
                      <td data-label="Rider">{o.riderName ?? <span className="subtle">None</span>}</td>
                      <td className="muted" data-label="Placed">{formatDateTime(o.createdAt)}</td>
                      <td className="num strong" data-label="Total">
                        {formatNaira(o.totalKobo)}
                        {o.refundedKobo > 0 ? <div className="small text-danger">−{formatNaira(o.refundedKobo)} refunded</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table__foot between">
              <span className="small muted">
                Showing {Math.min(shown, rows.length)} of {rows.length}
              </span>
              {rows.length > shown ? (
                <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                  Show more
                </Button>
              ) : null}
            </div>
          </>
        )}
      </section>

      {open ? <OrderDrawer order={open} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function OrderDrawer({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const cityName = useCityName();
  const canManage = useCan("orders.manage");
  const canRefund = useCan("orders.refund");
  const [action, setAction] = useState<"reassign" | "cancel" | "refund" | "resolve" | null>(null);
  const group = orderGroup(o.status);
  const inProgress = group === "pending" || group === "active";
  const refundable = o.totalKobo - o.refundedKobo;

  return (
    <Modal title={`Order ${o.code}`} side onClose={onClose}>
      <div className="stack">
        <div className="row wrap">
          <OrderBadge status={o.status} />
          <span className="badge">{o.type === "food" ? "Food order" : "Dispatch"}</span>
          <span className="small muted">{formatDateTime(o.createdAt)}</span>
        </div>
        {o.issue ? <p className="note note--danger">{o.issue}</p> : null}

        <KV
          rows={[
            ["Customer", <>{o.customer.name}<br /><a href={`tel:${o.customer.phone}`} className="text-primary">{o.customer.phone}</a></>],
            ...(o.vendorName ? ([["Vendor", o.vendorName]] as [string, string][]) : []),
            ["Rider", o.riderName ?? "Not assigned yet"],
            ["City", cityName(o.cityId)],
            ["Pick-up", o.pickup],
            ["Drop-off", o.dropoff],
          ]}
        />

        <div className="card stack-sm" style={{ boxShadow: "none" }}>
          {o.type === "food" ? <div className="between"><span className="muted">Food subtotal</span><span>{formatNaira(o.subtotalKobo)}</span></div> : null}
          <div className="between"><span className="muted">Delivery fee</span><span>{formatNaira(o.deliveryFeeKobo)}</span></div>
          <div className="between strong"><span>Customer paid ({o.paymentMethod})</span><span>{formatNaira(o.totalKobo)}</span></div>
          <div className="between small"><span className="muted">Vendo commission</span><span className="text-primary">{formatNaira(o.commissionKobo)}</span></div>
          {o.refundedKobo > 0 ? <div className="between small"><span className="muted">Refunded</span><span className="text-danger">−{formatNaira(o.refundedKobo)}</span></div> : null}
        </div>

        <div className="stack-sm">
          <h3 className="label">Actions</h3>
          {canManage ? (
            <div className="wrap">
              {inProgress ? <Button variant="secondary" size="sm" onClick={() => setAction("reassign")}>{o.riderName ? "Reassign rider" : "Assign rider"}</Button> : null}
              {o.status === "disputed" ? <Button size="sm" onClick={() => setAction("resolve")}>Resolve dispute</Button> : null}
              {inProgress || o.status === "disputed" ? <Button variant="danger" size="sm" onClick={() => setAction("cancel")}>Cancel order</Button> : null}
              {!inProgress && o.status !== "disputed" && !canRefund ? <span className="small muted">This order is closed.</span> : null}
            </div>
          ) : (
            <Locked permission="orders.manage" what="reassign or cancel orders" />
          )}
          {canRefund ? (
            refundable > 0 ? (
              <div>
                <Button variant="secondary" size="sm" onClick={() => setAction("refund")}>Refund customer</Button>
              </div>
            ) : (
              <span className="small muted">Fully refunded.</span>
            )
          ) : (
            <Locked permission="orders.refund" what="issue refunds" />
          )}
        </div>

        <div className="stack-sm">
          <h3 className="label">Timeline</h3>
          <ol className="timeline">
            {o.timeline.map((t, i) => (
              <li key={i}>
                <div className="strong">{t.label}</div>
                <div className="small muted">{formatDateTime(t.at)} · {t.by}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {action === "reassign" ? <Reassign order={o} onClose={() => setAction(null)} /> : null}
      {action === "cancel" ? <ActionModal title={`Cancel ${o.code}?`} intro="The customer, vendor and rider are told straight away. Cancelling doesn’t refund the customer — Finance does that separately." confirmLabel="Cancel order" danger refresh={["orders"]} run={({ reason }) => api.cancelOrder(o.id, reason)} onClose={() => setAction(null)} /> : null}
      {action === "refund" ? <ActionModal title={`Refund ${o.code}`} intro={`The money goes back to ${o.customer.name}’s Vendo wallet.`} confirmLabel="Send refund" amount={{ label: "Amount to refund", maxKobo: refundable, defaultKobo: refundable }} refresh={["orders", "transactions"]} run={({ reason, amountKobo }) => api.refundOrder(o.id, amountKobo, reason)} onClose={() => setAction(null)} /> : null}
      {action === "resolve" ? <ActionModal title="Resolve dispute" intro="Marks the order as delivered and closes the dispute. If the customer is owed money, ask Finance to refund them first." confirmLabel="Mark resolved" reasonLabel="What was decided" refresh={["orders"]} run={({ reason }) => api.resolveDispute(o.id, reason)} onClose={() => setAction(null)} /> : null}
    </Modal>
  );
}

function Reassign({ order, onClose }: { order: Order; onClose: () => void }) {
  const riders = useRiders();
  const [riderId, setRiderId] = useState("");
  const assign = useAction(() => api.reassignOrder(order.id, riderId), ["orders"]);
  const available = riders.data?.filter((r) => r.approval === "approved" && r.presence !== "offline" && r.cityId === order.cityId && r.id !== order.riderId) ?? [];
  return (
    <Modal
      title={order.riderName ? "Reassign rider" : "Assign rider"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!riderId} loading={assign.isPending} onClick={() => assign.mutate(undefined, { onSuccess: onClose })}>Assign</Button>
        </>
      }>
      <div className="stack">
        <p className="muted">{order.riderName ? `${order.riderName} is on this order now. ` : ""}Riders shown are online in the order’s city.</p>
        {!riders.data ? <p className="muted">Loading riders…</p> : available.length === 0 ? <p className="note note--warning">No other riders are online in this city right now.</p> : null}
        <div className="list" role="radiogroup" aria-label="Rider">
          {available.map((r) => (
            <button key={r.id} type="button" role="radio" aria-checked={riderId === r.id} className="list__row pick" onClick={() => setRiderId(r.id)}>
              <span className="avatar">{r.name.slice(0, 1)}</span>
              <span className="grow">
                <span className="strong">{r.name}</span>
                <br />
                <span className="small muted">{r.presence === "on_trip" ? "On another trip" : "Free now"} · {r.rating.toFixed(1)} ★ · {r.trips} trips</span>
              </span>
            </button>
          ))}
        </div>
        {assign.isError ? <p className="text-danger">{assign.error.message}</p> : null}
      </div>
    </Modal>
  );
}
