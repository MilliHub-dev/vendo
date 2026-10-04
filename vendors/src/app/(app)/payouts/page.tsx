"use client";

import { Landmark } from "lucide-react";
import { useState } from "react";

import { useBanks, usePayouts, useSaveBankAccount, useStore } from "@/api/queries";
import type { BankAccount } from "@/api/types";
import { Badge, Button, Input, Modal, Spinner } from "@/components/ui";
import { dayLabel } from "@/lib/dates";
import { formatNaira } from "@/lib/money";

export default function PayoutsPage() {
  const payouts = usePayouts();
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const p = payouts.data;
  if (!p) return <Spinner />;
  const rate = Math.round((store.data?.commissionRate ?? 0.15) * 100);

  return (
    <>
      <div className="grid-2">
        <section className="card" style={{ background: "var(--blue)", borderColor: "var(--blue)", color: "#fff", boxShadow: "var(--shadow-blue)" }}>
          <span style={{ opacity: 0.85 }}>Owed to you</span>
          <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{formatNaira(p.balanceKobo)}</div>
          <span style={{ opacity: 0.9 }}>Next payout: {dayLabel(new Date(p.nextPayoutDate))}</span>
        </section>

        <section className="card">
          <div className="card__head">
            <h2>Bank account</h2>
            {p.account ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Change
              </Button>
            ) : null}
          </div>
          {p.account ? (
            <div className="row">
              <div className="avatar">
                <Landmark size={18} />
              </div>
              <div className="grow">
                <div className="strong">
                  {p.account.bankName} ••••{p.account.accountNumber.slice(-4)}
                </div>
                <div className="small muted">{p.account.accountName}</div>
              </div>
            </div>
          ) : (
            <div className="stack-sm">
              <p className="note note--warning">Add a bank account to get paid. We can’t send your payouts until you do.</p>
              <Button onClick={() => setEditing(true)}>Add bank account</Button>
            </div>
          )}
        </section>
      </div>

      <p className="small muted">
        You receive the food subtotal of each delivered order, less Vendo’s {rate}% commission. Payouts go to your bank account every week.
      </p>

      <section className="card card--flush">
        <div className="card__head" style={{ padding: "18px 20px 0" }}>
          <h2>Payout history</h2>
        </div>
        {p.history.length === 0 ? (
          <p className="muted" style={{ padding: "0 20px 20px" }}>
            No payouts yet. Your first one arrives the week after your first delivered order.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Orders</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.history.map((h) => (
                  <tr key={h.id}>
                    <td className="strong">{dayLabel(new Date(h.date))}</td>
                    <td data-label="Orders">{h.orders}</td>
                    <td>
                      <Badge tone={h.status === "paid" ? "success" : "warning"}>{h.status === "paid" ? "Paid" : "Scheduled"}</Badge>
                    </td>
                    <td className="num strong" data-label="Amount">
                      {formatNaira(h.amountKobo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing ? <AccountModal current={p.account} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

function AccountModal({ current, onClose }: { current: BankAccount | null; onClose: () => void }) {
  const banks = useBanks();
  const save = useSaveBankAccount();
  const [bankCode, setBankCode] = useState(current?.bankCode ?? "");
  const [number, setNumber] = useState(current?.accountNumber ?? "");
  const [name, setName] = useState(current?.accountName ?? "");
  const [touched, setTouched] = useState(false);
  const errors = { bank: !bankCode ? "Choose your bank" : null, number: !/^\d{10}$/.test(number) ? "Account numbers have 10 digits" : null, name: name.trim().length < 3 ? "Enter the name on the account" : null };

  const submit = () => {
    setTouched(true);
    if (!Object.values(errors).some(Boolean)) save.mutate({ bankCode, accountNumber: number, accountName: name.trim() }, { onSuccess: onClose });
  };

  return (
    <Modal
      title="Bank account for payouts"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Save account
          </Button>
        </>
      }>
      <div className="field">
        <label htmlFor="bank">Bank</label>
        <select id="bank" className="select" value={bankCode} onChange={(e) => setBankCode(e.target.value)} aria-invalid={(touched && !!errors.bank) || undefined}>
          <option value="" disabled>
            Choose your bank
          </option>
          {banks.data?.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
        {touched && errors.bank ? <span className="field__error">{errors.bank}</span> : null}
      </div>
      <Input label="Account number" placeholder="10 digits" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} error={touched ? errors.number : null} />
      <Input label="Account name" placeholder="As it appears at your bank" value={name} onChange={(e) => setName(e.target.value)} error={touched ? errors.name : null} />
      {save.isError ? <p className="text-danger">{save.error.message}</p> : null}
    </Modal>
  );
}
