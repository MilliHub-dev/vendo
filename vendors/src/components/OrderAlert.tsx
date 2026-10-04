"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";

import { useOrderAction, useOrders } from "@/api/queries";
import type { Order } from "@/api/types";
import { formatNaira } from "@/lib/money";
import { clock, itemCount, secondsLeft } from "@/lib/orders";
import { useNow } from "@/lib/use-now";
import { useUi } from "@/store/ui";

import { PrepTimeModal } from "./OrderActions";
import { Button } from "./ui";

/** A short two-tone chime. Browsers only allow sound after the vendor has clicked something on the page. */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
  } catch {
    /* no audio available: the visual alert still shows */
  }
}

/** New-order alert, shown on every dashboard page. The countdown follows the server's `respondBy`. */
export function OrderAlert() {
  const orders = useOrders();
  const seen = useUi((s) => s.seen);
  const openId = useUi((s) => s.openOrderId);
  const next = orders.data?.find((o) => o.status === "new" && !seen[o.id] && o.id !== openId);
  return next ? <Alert key={next.id} order={next} /> : null;
}

function Alert({ order }: { order: Order }) {
  const act = useOrderAction();
  const { markSeen, openOrder } = useUi();
  const now = useNow();
  const [accepting, setAccepting] = useState(false);
  const left = secondsLeft(order.respondBy, now);

  useEffect(() => {
    chime();
    const title = document.title;
    document.title = "🔔 New order — Vendo";
    return () => {
      document.title = title;
    };
  }, []);

  if (accepting) return <PrepTimeModal loading={act.isPending} error={act.isError ? act.error.message : null} onClose={() => setAccepting(false)} onConfirm={(prepMinutes) => act.mutate({ id: order.id, action: "accept", prepMinutes }, { onSuccess: () => markSeen(order.id) })} />;

  return (
    <div className="alert" role="alertdialog" aria-label="New order">
      <div className="row">
        <div className="alert__bell">
          <BellRing size={20} />
        </div>
        <div className="grow">
          <div className="strong" style={{ fontSize: 17 }}>
            New order
          </div>
          <div className="small muted">
            {order.code} · for {order.customerName}
          </div>
        </div>
        <span className={left <= 30 ? "timer timer--urgent" : "timer"} aria-label={`${left} seconds left to answer`}>
          {clock(left)}
        </span>
      </div>
      <div className="note stack-sm">
        {order.items.map((i) => (
          <div key={i.name}>
            <span className="strong">
              {i.quantity} × {i.name}
            </span>
            {i.note ? <div className="small" style={{ color: "var(--warning)" }}>Note: {i.note}</div> : null}
          </div>
        ))}
      </div>
      <div className="between">
        <span className="muted">
          {itemCount(order)} item{itemCount(order) === 1 ? "" : "s"} · you receive
        </span>
        <strong className="text-primary" style={{ fontSize: 22 }}>
          {formatNaira(order.payoutKobo)}
        </strong>
      </div>
      <Button block onClick={() => setAccepting(true)}>
        Accept order
      </Button>
      <div className="row">
        <Button
          variant="secondary"
          block
          onClick={() => {
            markSeen(order.id);
            openOrder(order.id);
          }}>
          View order
        </Button>
        <Button variant="ghost" block onClick={() => markSeen(order.id)}>
          Later
        </Button>
      </div>
    </div>
  );
}
