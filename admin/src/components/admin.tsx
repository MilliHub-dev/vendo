"use client";

import { Download, Lock, Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import { api } from "@/api/client";
import { useAction, useCities } from "@/api/queries";
import type { Approval, Order, Vendor } from "@/api/types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatNaira, nairaToKobo } from "@/lib/money";
import { can, orderGroup, orderStatusLabel, whoCan, type Permission } from "@/lib/permissions";
import { useSession } from "@/store/session";

import { Badge, Button, Input, Modal, Textarea } from "./ui";

/** Whether the signed-in admin's role allows an action. */
export const useCan = (permission: Permission) => can(useSession((s) => s.admin?.role), permission);

/** Shown in place of actions the role can't take, so it's clear why they're missing. */
export function Locked({ permission, what }: { permission: Permission; what: string }) {
  return (
    <p className="note row small">
      <Lock size={16} /> Your role can’t {what}. Ask {whoCan[permission]}.
    </p>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; label: string; tabs: { value: T; label: string; count?: number; alert?: boolean }[] }) {
  return (
    <div className="wrap" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" className="chip" aria-selected={value === t.value} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count ? <span className={t.alert && value !== t.value ? "chip__count chip__count--alert" : "chip__count"}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search">
      <Search />
      <input className="input" type="search" placeholder={placeholder} aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function CitySelect({ value, onChange, all = true }: { value: string; onChange: (v: string) => void; all?: boolean }) {
  const { data } = useCities();
  return (
    <select className="select select--inline" aria-label="City" value={value} onChange={(e) => onChange(e.target.value)}>
      {all ? <option value="">All cities</option> : null}
      {data?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
export function useCityName() {
  const { data } = useCities();
  return (id: string) => data?.find((c) => c.id === id)?.name ?? id;
}

export function ExportButton<T>({ rows, filename, columns }: { rows: T[]; filename: string; columns: [string, (row: T) => string | number][] }) {
  return (
    <Button variant="secondary" size="sm" disabled={rows.length === 0} onClick={() => downloadCsv(filename, toCsv(columns.map((c) => c[0]), rows.map((r) => columns.map((c) => c[1](r)))))}>
      <Download /> Export CSV
    </Button>
  );
}

const orderTone = { pending: "warning", active: "primary", completed: "success", cancelled: undefined, disputed: "danger" } as const;
export const OrderBadge = ({ status }: { status: Order["status"] }) => <Badge tone={orderTone[orderGroup(status)]}>{orderStatusLabel[status]}</Badge>;

const approvalTone = { pending: "warning", under_review: "warning", approved: "success", rejected: "danger", suspended: "danger" } as const;
const approvalLabel = { pending: "Awaiting review", under_review: "Awaiting review", approved: "Approved", rejected: "Rejected", suspended: "Suspended" } as const;
export const ApprovalBadge = ({ status }: { status: Approval | Vendor["approval"] }) => <Badge tone={approvalTone[status]}>{approvalLabel[status]}</Badge>;

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

type Keys = Parameters<typeof useAction>[1];

/**
 * A dialog for any admin action that needs a reason (and sometimes an amount).
 * The reason is saved to the audit log, so it is required unless `reasonOptional`.
 */
export function ActionModal({ title, intro, confirmLabel, danger, amount, reasonLabel = "Reason", reasonOptional, refresh, run, onClose, onDone, children }: {
  title: string;
  intro?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** show an amount field; `maxKobo` caps it */
  amount?: { label: string; maxKobo?: number; defaultKobo?: number };
  reasonLabel?: string;
  reasonOptional?: boolean;
  refresh: Keys;
  run: (values: { reason: string; amountKobo: number }) => Promise<unknown>;
  onClose: () => void;
  onDone?: () => void;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [naira, setNaira] = useState(amount?.defaultKobo ? String(amount.defaultKobo / 100) : "");
  const [touched, setTouched] = useState(false);
  const action = useAction(run, refresh);
  const amountKobo = nairaToKobo(Number(naira) || 0);
  const amountError = !amount ? null : amountKobo <= 0 ? "Enter an amount" : amount.maxKobo !== undefined && amountKobo > amount.maxKobo ? `The most you can enter is ${formatNaira(amount.maxKobo)}` : null;
  const reasonError = !reasonOptional && reason.trim().length < 4 ? "Give a reason — it’s saved to the audit log" : null;

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={action.isPending}
            onClick={() => {
              setTouched(true);
              if (amountError || reasonError) return;
              action.mutate({ reason, amountKobo }, { onSuccess: () => (onDone?.(), onClose()) });
            }}>
            {confirmLabel}
          </Button>
        </>
      }>
      <div className="stack">
        {intro ? <p className="muted">{intro}</p> : null}
        {children}
        {amount ? <Input label={amount.label} prefix="₦" inputMode="decimal" placeholder="0" value={naira} onChange={(e) => setNaira(e.target.value.replace(/[^\d.]/g, ""))} error={touched ? amountError : null} hint={amount.maxKobo !== undefined ? `Up to ${formatNaira(amount.maxKobo)}` : undefined} /> : null}
        <Textarea label={reasonOptional ? `${reasonLabel} (optional)` : reasonLabel} rows={3} placeholder="Saved to the audit log with your name" value={reason} onChange={(e) => setReason(e.target.value)} error={touched ? reasonError : null} />
        {action.isError ? <p className="text-danger">{action.error.message}</p> : null}
      </div>
    </Modal>
  );
}

/** Credit or debit a customer or rider wallet (finance only). */
export function WalletAdjust({ party, id, name, balanceKobo, refresh, onClose }: { party: "customer" | "rider"; id: string; name: string; balanceKobo: number; refresh: Keys; onClose: () => void }) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  return (
    <ActionModal
      title={`Adjust ${name}’s wallet`}
      intro={`Current balance: ${formatNaira(balanceKobo)}. Use this only to correct a mistake or settle a complaint.`}
      confirmLabel={direction === "credit" ? "Add money" : "Take money"}
      danger={direction === "debit"}
      amount={{ label: "Amount", maxKobo: direction === "debit" ? balanceKobo : undefined }}
      refresh={[...refresh, "transactions"]}
      run={({ reason, amountKobo }) => api.adjustWallet(party, id, direction, amountKobo, reason)}
      onClose={onClose}>
      <div className="wrap" role="radiogroup" aria-label="Direction">
        {(["credit", "debit"] as const).map((d) => (
          <button key={d} type="button" role="radio" className="chip" aria-checked={direction === d} onClick={() => setDirection(d)}>
            {d === "credit" ? "Add money (credit)" : "Take money (debit)"}
          </button>
        ))}
      </div>
    </ActionModal>
  );
}
