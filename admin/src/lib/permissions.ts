import type { OrderGroup, OrderStatus, Role } from "@/api/types";

/**
 * Who may do what. The UI hides or disables actions with this, but it is only a
 * convenience — the server must enforce the same rules on every request.
 * From VENDO_DEVELOPMENT.md §8.8: wallet adjustments and withdrawal approvals are finance-only.
 */
export type Permission =
  | "orders.manage" // reassign rider, cancel
  | "orders.refund"
  | "riders.review" // approve, reject, suspend
  | "vendors.manage"
  | "wallet.adjust"
  | "withdrawals.decide"
  | "cities.manage"
  | "promos.manage"
  | "notifications.send"
  | "audit.view";

const grants: Record<Role, Permission[] | "all"> = {
  super_admin: "all",
  ops: ["orders.manage", "riders.review", "vendors.manage", "cities.manage", "promos.manage", "notifications.send", "audit.view"],
  finance: ["orders.refund", "wallet.adjust", "withdrawals.decide", "audit.view"],
  support: ["orders.manage"],
};

export const can = (role: Role | undefined, permission: Permission) => !!role && (grants[role] === "all" || grants[role].includes(permission));

export const roleLabel: Record<Role, string> = { super_admin: "Super admin", ops: "Operations", finance: "Finance", support: "Support" };

/** Which role to ask when an action isn't allowed. */
export const whoCan: Record<Permission, string> = {
  "orders.manage": "Operations or Support",
  "orders.refund": "Finance",
  "riders.review": "Operations",
  "vendors.manage": "Operations",
  "wallet.adjust": "Finance",
  "withdrawals.decide": "Finance",
  "cities.manage": "Operations",
  "promos.manage": "Operations",
  "notifications.send": "Operations",
  "audit.view": "Operations or Finance",
};

export const orderGroup = (status: OrderStatus): OrderGroup =>
  status === "delivered" ? "completed" : status === "cancelled" ? "cancelled" : status === "disputed" ? "disputed" : status === "awaiting_vendor" || status === "searching_rider" ? "pending" : "active";

export const orderStatusLabel: Record<OrderStatus, string> = {
  awaiting_vendor: "Awaiting vendor",
  searching_rider: "Finding rider",
  rider_assigned: "Rider assigned",
  picked_up: "Picked up",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  disputed: "Disputed",
};
