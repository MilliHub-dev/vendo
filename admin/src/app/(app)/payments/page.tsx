"use client";

import { Banknote } from "lucide-react";
import { useState } from "react";

import { api } from "@/api/client";
import { useAction, useTransactions, useVendors, useWithdrawals } from "@/api/queries";
import type { TransactionKind, Withdrawal } from "@/api/types";
import { ActionModal, ExportButton, Locked, SearchBox, Tabs, useCan, useCityName } from "@/components/admin";
import { Badge, Button, Empty, Spinner } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";

const kindLabel: Record<TransactionKind, string> = { topup: "Wallet top-up", order_payment: "Order payment", refund: "Refund", rider_earning: "Rider earning", commission: "Commission", withdrawal: "Withdrawal", adjustment: "Manual adjustment" };
const wdTone = { pending: "warning", paid: "success", declined: "danger" } as const;
const wdLabel = { pending: "Waiting", paid: "Paid", declined: "Declined" };

export default function PaymentsPage() {
  const withdrawals = useWithdrawals();
  const [tab, setTab] = useState<"withdrawals" | "transactions" | "commissions">("withdrawals");
  return (
    <>
      <Tabs
        label="Payments"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "withdrawals", label: "Rider withdrawals", count: withdrawals.data?.filter((w) => w.status === "pending").length, alert: true },
          { value: "transactions", label: "Transactions" },
          { value: "commissions", label: "Commission report" },
        ]}
      />
      {tab === "withdrawals" ? <Withdrawals list={withdrawals.data} /> : tab === "transactions" ? <Transactions /> : <Commissions />}
    </>
  );
}

function Withdrawals({ list }: { list?: Withdrawal[] }) {
  const canDecide = useCan("withdrawals.decide");
  const [declining, setDeclining] = useState<Withdrawal | null>(null);
  const approve = useAction((id: string) => api.decideWithdrawal(id, "approve", ""), ["withdrawals", "transactions", "riders"]);
  if (!list) return <Spinner />;
  const waiting = list.filter((w) => w.status === "pending");
  return (
    <>
      {!canDecide ? <Locked permission="withdrawals.decide" what="approve or decline withdrawals" /> : null}
      <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="card stat"><span className="stat__label">Waiting for approval</span><span className="stat__value">{waiting.length}</span></div>
        <div className="card stat"><span className="stat__label">Amount waiting</span><span className="stat__value stat__value--accent">{formatNaira(waiting.reduce((n, w) => n + w.amountKobo, 0))}</span></div>
      </div>
      {approve.isError ? <p className="note note--danger">{approve.error.message}</p> : null}
      <section className="card card--flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rider</th>
                <th>Bank</th>
                <th>Requested</th>
                <th>Status</th>
                <th className="num">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} data-new={w.status === "pending"}>
                  <td className="strong">{w.riderName}</td>
                  <td data-label="Bank">{w.bankName} <span className="muted">{w.accountNumber}</span></td>
                  <td className="muted" data-label="Requested">{formatDateTime(w.createdAt)}</td>
                  <td>
                    <Badge tone={wdTone[w.status]}>{wdLabel[w.status]}</Badge>
                    {w.note ? <div className="small muted">{w.note}</div> : null}
                  </td>
                  <td className="num strong" data-label="Amount">{formatNaira(w.amountKobo)}</td>
                  <td>
                    {w.status === "pending" && canDecide ? (
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <Button size="sm" loading={approve.isPending && approve.variables === w.id} onClick={() => approve.mutate(w.id)}>Approve</Button>
                        <Button size="sm" variant="secondary" onClick={() => setDeclining(w)}>Decline</Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {declining ? <ActionModal title={`Decline ${formatNaira(declining.amountKobo)} to ${declining.riderName}?`} intro="The money goes back to the rider’s wallet and they see your reason." confirmLabel="Decline withdrawal" danger refresh={["withdrawals", "riders"]} run={({ reason }) => api.decideWithdrawal(declining.id, "decline", reason)} onClose={() => setDeclining(null)} /> : null}
    </>
  );
}

function Transactions() {
  const { data } = useTransactions();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  if (!data) return <Spinner />;
  const q = query.trim().toLowerCase();
  const rows = data.filter((t) => (!kind || t.kind === kind) && (!q || [t.reference, t.party].some((v) => v.toLowerCase().includes(q))));
  return (
    <>
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search reference or name" />
        <select className="select select--inline" aria-label="Transaction type" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(kindLabel).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <span className="grow" />
        <ExportButton rows={rows} filename="vendo-transactions.csv" columns={[["Reference", (t) => t.reference], ["Type", (t) => kindLabel[t.kind]], ["Party", (t) => t.party], ["Direction", (t) => t.direction], ["Amount (NGN)", (t) => t.amountKobo / 100], ["Channel", (t) => t.channel], ["Status", (t) => t.status], ["Date", (t) => t.createdAt], ["Note", (t) => t.note ?? ""]]} />
      </div>
      <section className="card card--flush">
        {rows.length === 0 ? (
          <Empty icon={<Banknote />} title="No transactions match">Try a different type or search.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Party</th>
                  <th>Channel</th>
                  <th>Date</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="strong">{t.reference}</span>
                      {t.note ? <div className="small muted">{t.note}</div> : null}
                    </td>
                    <td>{kindLabel[t.kind]} {t.status === "failed" ? <Badge tone="danger">Failed</Badge> : null}</td>
                    <td data-label="Party">{t.party}</td>
                    <td className="muted" data-label="Channel" style={{ textTransform: "capitalize" }}>{t.channel}</td>
                    <td className="muted" data-label="Date">{formatDateTime(t.createdAt)}</td>
                    <td className={`num strong ${t.status === "failed" ? "subtle" : t.direction === "credit" ? "text-success" : ""}`} data-label="Amount">
                      {t.direction === "credit" ? "+" : "−"}{formatNaira(t.amountKobo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 60 ? <div className="table__foot small muted">Showing the latest 60 of {rows.length}. Export to see them all.</div> : null}
      </section>
    </>
  );
}

function Commissions() {
  const { data } = useVendors();
  const cityName = useCityName();
  if (!data) return <Spinner />;
  const rows = data.filter((v) => v.orders30d > 0).map((v) => ({ ...v, earnedKobo: Math.round(v.revenue30dKobo * v.commissionRate) })).sort((a, b) => b.earnedKobo - a.earnedKobo);
  const total = rows.reduce((n, v) => n + v.earnedKobo, 0);
  return (
    <>
      <div className="toolbar">
        <div className="grow">
          <div className="small muted">Vendo’s commission, last 30 days</div>
          <div className="stat__value stat__value--accent">{formatNaira(total)}</div>
        </div>
        <ExportButton rows={rows} filename="vendo-commission-report.csv" columns={[["Vendor", (v) => v.name], ["City", (v) => cityName(v.cityId)], ["Orders (30d)", (v) => v.orders30d], ["Sales (NGN)", (v) => v.revenue30dKobo / 100], ["Rate", (v) => `${Math.round(v.commissionRate * 100)}%`], ["Commission (NGN)", (v) => v.earnedKobo / 100]]} />
      </div>
      <section className="card card--flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>City</th>
                <th className="num">Orders</th>
                <th className="num">Sales</th>
                <th className="num">Rate</th>
                <th className="num">Commission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="strong">{v.name}</td>
                  <td data-label="City">{cityName(v.cityId)}</td>
                  <td className="num" data-label="Orders">{v.orders30d}</td>
                  <td className="num" data-label="Sales">{formatNaira(v.revenue30dKobo)}</td>
                  <td className="num" data-label="Rate">{Math.round(v.commissionRate * 100)}%</td>
                  <td className="num strong text-primary" data-label="Commission">{formatNaira(v.earnedKobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
