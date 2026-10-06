import type { ReactNode } from "react";

import { Badge } from "@/components/ui";

import { formatNaira } from "./money";

/**
 * Turns the API's raw field names and values into something a person can read:
 * "paid_total_kobo: 4500000" becomes "Paid total · ₦45,000". Used by every table and detail panel.
 */
const SPECIAL: Record<string, string> = {
  id: "ID", profile_id: "Account ID", city_id: "City", vendor_id: "Vendor", order_id: "Order", rider_id: "Rider", customer_id: "Customer", actor_id: "Staff ID", actor_name: "Staff", target_id: "Target",
  is_active: "Active", is_open: "Open", is_available: "Available", lat: "Latitude", lng: "Longitude", mime: "File type", city_ids: "Cities", image_url: "Image", logo_url: "Logo",
  delivered_30d: "Delivered (30 days)", sales_30d_kobo: "Sales (30 days)", avg_delivery_seconds: "Average delivery time", captured_at: "Last location", location_stale: "Location out of date",
  device_sends: "Sent to devices", inbox_reads: "Read in app", used_count: "Times used", max_uses: "Use limit", send_at: "Send time",
  initial_radius_m: "First search distance", max_radius_m: "Furthest search distance", radius_step_m: "Widen by", expansion_seconds: "Widen every", offer_seconds: "Time to accept", search_seconds: "Give up after",
  location_max_age_seconds: "Oldest location allowed", max_accuracy_m: "Least GPS accuracy allowed", surge_bps: "Surge", commission_bps: "Commission", vendor_commission_bps: "Vendor commission", rider_delivery_bps: "Rider share of delivery",
};

export function labelOf(key: string): string {
  if (SPECIAL[key]) return SPECIAL[key];
  const words = key.replace(/_(kobo|at|bps)$/, "").replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const GOOD = ["approved", "active", "delivered", "paid", "succeeded", "sent", "completed", "resolved", "open_for_orders", "online", "accepted", "refunded"];
const WAITING = ["pending", "requested", "scheduled", "awaiting_vendor", "searching_rider", "pending_payment", "review", "submitting", "queued", "open", "unpaid", "sending"];
const MOVING = ["rider_assigned", "picked_up", "on_the_way", "on_trip", "in_progress"];
const BAD = ["rejected", "failed", "cancelled", "disputed", "suspended", "reversed", "deactivated", "expired", "offline"];
const STATUS_KEYS = /(^|_)(status|approval|decision|state|kind|type|audience|action|method|purpose|category|basis|scope|presence)$/;
const words = (v: string) => v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-NG", { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric", hour: "numeric", minute: "2-digit" });
};
export const formatDuration = (seconds: number) => (seconds < 90 ? `${Math.round(seconds)} sec` : seconds < 5400 ? `${Math.round(seconds / 60)} min` : `${(seconds / 3600).toFixed(1)} hr`);
export const formatPercent = (bps: number) => `${(bps / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}%`;
const shortId = (id: string) => (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id) ? `${id.slice(0, 8)}…` : id);

/** Plain text, for CSV export and search. */
export function textOf(value: unknown): string {
  return value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
}

/**
 * One cell. `names` maps IDs we can name (cities) to their names. `full` is the detail panel,
 * where long values aren't shortened.
 */
export function formatValue(key: string, value: unknown, names: Record<string, string> = {}, full = false): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="subtle">—</span>;
  if (typeof value === "boolean") return key === "location_stale" ? (value ? <Badge tone="warning">Out of date</Badge> : <Badge tone="success">Current</Badge>) : <Badge tone={value ? "success" : undefined}>{value ? "Yes" : "No"}</Badge>;
  if (key.endsWith("_kobo") && (typeof value === "number" || /^-?\d+$/.test(String(value)))) return <span className="num-cell">{formatNaira(Number(value))}</span>;
  // surge is a multiplier on the delivery fee: 10000 means the normal price
  if (key === "surge_bps" && typeof value === "number") return value === 10000 ? "Normal" : `${(value / 10000).toLocaleString("en-NG", { maximumFractionDigits: 2 })}× normal`;
  if (key.endsWith("_bps") && typeof value === "number") return formatPercent(value);
  if (typeof value === "string" && /^\d{2}:\d{2}:\d{2}$/.test(value)) return value.slice(0, 5);
  if (key.endsWith("_seconds") && typeof value === "number") return formatDuration(value);
  if (/_m$/.test(key) && typeof value === "number") return value >= 1000 ? `${(value / 1000).toLocaleString("en-NG", { maximumFractionDigits: 1 })} km` : `${value} m`;
  if ((key.endsWith("_at") || key === "day") && typeof value === "string") return key === "day" ? new Date(value).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" }) : formatDate(value);
  if (key === "rating" && typeof value === "number") return value ? `${value.toFixed(1)} ★` : <span className="subtle">New</span>;
  if ((key === "city_id" || key === "city_ids") && typeof value !== "number") {
    const ids = Array.isArray(value) ? value.map(String) : [String(value)];
    return ids.map((id) => names[id] ?? shortId(id)).join(", ");
  }
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    if (/image|logo|photo/.test(key)) return <a href={value} target="_blank" rel="noreferrer"><img className="cell-thumb" src={value} alt="" loading="lazy" /></a>;
    return <a className="text-primary" href={value} target="_blank" rel="noreferrer">Open link</a>;
  }
  if (typeof value === "string" && STATUS_KEYS.test(key) && /^[a-z_]+$/.test(value)) {
    const tone = GOOD.includes(value) ? "success" : BAD.includes(value) ? "danger" : WAITING.includes(value) ? "warning" : MOVING.includes(value) ? "primary" : undefined;
    return <Badge tone={tone}>{words(value)}</Badge>;
  }
  if (typeof value === "object") {
    if (!full) {
      const summary = Array.isArray(value) ? `${value.length} item${value.length === 1 ? "" : "s"}` : Object.entries(value as Record<string, unknown>).slice(0, 3).map(([k, v]) => `${labelOf(k)}: ${typeof v === "object" ? "…" : String(v)}`).join(" · ");
      return <span className="muted">{summary || "—"}</span>;
    }
    if (!Array.isArray(value)) return <NestedValue value={value as Record<string, unknown>} names={names} />;
    return <pre className="code-block">{JSON.stringify(value, null, 2)}</pre>;
  }
  if (typeof value === "string" && (key === "id" || key.endsWith("_id")) && !full) return <span className="mono" title={value}>{shortId(value)}</span>;
  if (typeof value === "string" && (key === "id" || key.endsWith("_id"))) return <span className="mono">{value}</span>;
  return String(value);
}

function NestedValue({ value, names }: { value: Record<string, unknown>; names: Record<string, string> }) {
  return (
    <dl className="kv kv--nested">
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          <dt>{labelOf(k)}</dt>
          <dd>{typeof v === "object" && v !== null ? <pre className="code-block">{JSON.stringify(v, null, 2)}</pre> : formatValue(k, v, names, true)}</dd>
        </div>
      ))}
    </dl>
  );
}
