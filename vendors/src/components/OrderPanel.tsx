"use client";

import { Bike } from "lucide-react";
import { useState } from "react";

import { useOrderAction, useOrders } from "@/api/queries";
import type { Order } from "@/api/types";
import { formatDateTime, formatTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { clock, secondsLeft, statusLabel } from "@/lib/orders";
import { useNow } from "@/lib/use-now";
import { useUi } from "@/store/ui";

import { PrepTimeModal, RejectModal } from "./OrderActions";
import { Badge, Button, Modal } from "./ui";

export const statusTone = (o: Order) => (o.status === "delivered" ? "success" : o.status === "rejected" || o.status === "cancelled" ? "danger" : o.status === "new" ? "warning" : "primary");

const guidance: Partial<Record<Order["status"], string>> = {
  preparing: "Cook and pack the order. Mark it ready as soon as it’s packed so the rider isn’t kept waiting.",
  ready: "Hand the order to the Vendo rider when they arrive. Check the order code with them.",
  picked_up: "The rider has collected this order and is on the way to the customer.",
  delivered: "Delivered to the customer. This order is included in your next payout.",
  rejected: "You rejected this order. The customer was refunded in full.",
  cancelled: "This order was cancelled. Nothing is owed for it.",
};

/** The order side panel. Mounted once in the app shell; any page opens it with useUi().openOrder(id). */
export function OrderPanel() {
  const id = useUi((s) => s.openOrderId);
  const close = () => useUi.getState().openOrder(null);
  const order = useOrders().data?.find((o) => o.id === id);
  return order ? <Panel key={order.id} order={order} onClose={close} /> : null;
}

function Panel({ order, onClose }: { order: Order; onClose: () => void }) {
  const act = useOrderAction();
  const now = useNow();
  const [modal, setModal] = useState<"accept" | "reject" | null>(null);
  const left = secondsLeft(order.respondBy, now);

  if (modal === "accept") return <PrepTimeModal loading={act.isPending} error={act.isError ? act.error.message : null} onClose={() => setModal(null)} onConfirm={(prepMinutes) => act.mutate({ id: order.id, action: "accept", prepMinutes }, { onSuccess: () => setModal(null) })} />;
  if (modal === "reject") return <RejectModal loading={act.isPending} error={act.isError ? act.error.message : null} onClose={() => setModal(null)} onConfirm={(reason) => act.mutate({ id: order.id, action: "reject", reason }, { onSuccess: () => setModal(null) })} />;

  const footer =
    order.status === "new" ? (
      <>
        <Button variant="secondary" onClick={() => setModal("reject")}>
          Reject
        </Button>
        <Button onClick={() => setModal("accept")}>Accept order</Button>
      </>
    ) : order.status === "preparing" ? (
      <Button loading={act.isPending} onClick={() => act.mutate({ id: order.id, action: "ready" })}>
        Mark ready for pickup
      </Button>
    ) : undefined;

  return (
    <Modal side title={`Order ${order.code}`} onClose={onClose} footer={footer}>
      <div className="stack-sm">
        <div className="between">
          <h3>{order.customerName && order.customerName !== "Customer" ? `For ${order.customerName}` : "Order items"}</h3>
          <Badge tone={statusTone(order)}>{statusLabel[order.status]}</Badge>
        </div>
        <p className="small muted">
          Placed {formatDateTime(order.createdAt)}
          {order.readyBy && order.status === "preparing" ? ` · ready by ${formatTime(new Date(order.readyBy))}` : ""}
        </p>
      </div>

      {order.status === "new" ? (
        <div className="between note" style={{ background: left <= 30 ? "var(--danger)" : "var(--blue)", color: "#fff" }}>
          <span>Accept or reject within</span>
          <strong style={{ fontSize: 22 }}>{clock(left)}</strong>
        </div>
      ) : guidance[order.status] ? (
        <p className="note">
          {guidance[order.status]}
          {order.rejectReason && order.status !== "delivered" ? ` Reason: ${order.rejectReason}.` : ""}
        </p>
      ) : null}

      {order.rider && (order.status === "ready" || order.status === "picked_up") ? (
        <div className="row card" style={{ padding: 14 }}>
          <div className="avatar">
            <Bike size={18} />
          </div>
          <div className="grow">
            <div className="strong">{order.rider.name}</div>
            <div className="small muted">Vendo rider · {order.rider.plateNumber}</div>
          </div>
          <Badge tone={order.status === "ready" ? "warning" : "success"}>{order.status === "ready" ? "On the way to you" : "Collected"}</Badge>
        </div>
      ) : null}

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Items
        </div>
        <div className="list">
          {order.items.map((i) => (
            <div key={i.name} style={{ padding: "10px 0" }}>
              <div className="between">
                <span className="strong">
                  {i.quantity} × {i.name}
                </span>
                <span>{formatNaira(i.unitPriceKobo * i.quantity)}</span>
              </div>
              {i.note ? (
                <div style={{ marginTop: 6 }}>
                  <Badge tone="warning">Customer note: {i.note}</Badge>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Payment
        </div>
        <div className="stack-sm">
          <div className="between">
            <span className="muted">Food subtotal</span>
            <span>{formatNaira(order.subtotalKobo)}</span>
          </div>
          <div className="between">
            <span className="muted">Vendo commission</span>
            <span>− {formatNaira(order.commissionKobo)}</span>
          </div>
          <div className="between" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
            <span className="strong">You receive</span>
            <strong className="text-primary" style={{ fontSize: 20 }}>
              {formatNaira(order.payoutKobo)}
            </strong>
          </div>
        </div>
        <p className="small subtle" style={{ marginTop: 10 }}>
          The customer has already paid Vendo. The delivery fee goes to the rider and isn’t part of your order.
        </p>
      </div>
      {act.isError ? <p className="text-danger">{act.error.message}</p> : null}
    </Modal>
  );
}
