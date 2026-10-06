"use client";

import { Banknote, Clock, Landmark, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { keys, useBanks, usePayouts, useSaveBankAccount } from "@/api/queries";
import { Badge, Button, Empty, Input, Modal, Spinner } from "@/components/ui";
import { dayLabel } from "@/lib/dates";
import { formatNaira, nairaToKobo } from "@/lib/money";

/** The server's withdrawal states, in the vendor's words. */
const statusView: Record<string, { label: string; tone?: "primary" | "success" | "warning" | "danger"; hint: string }> = {
  requested: { label: "Waiting for approval", tone: "warning", hint: "The Vendo team reviews every withdrawal." },
  approved: { label: "Approved", tone: "primary", hint: "Being sent to your bank." },
  submitting: { label: "Sending", tone: "primary", hint: "Being sent to your bank." },
  pending: { label: "Sending", tone: "primary", hint: "With the bank. This can take a few hours." },
  review: { label: "Being checked", tone: "warning", hint: "We’re confirming this transfer with the bank." },
  succeeded: { label: "Paid", tone: "success", hint: "Sent to your bank account." },
  rejected: { label: "Declined", tone: "danger", hint: "The money is back in your balance." },
  failed: { label: "Failed", tone: "danger", hint: "The money is back in your balance." },
  reversed: { label: "Returned", tone: "danger", hint: "The bank returned it. The money is back in your balance." },
};

/** What the store has earned, where it gets paid, and every withdrawal. */
export default function PayoutsPage() {
  const payouts = usePayouts();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const withdraw = useMutation({
    mutationFn: () => api.requestWithdrawal(nairaToKobo(Number(amount))),
    onSuccess: () => {
      setAmount("");
      client.invalidateQueries({ queryKey: keys.payouts });
    },
  });

  if (payouts.isError) return <p className="note note--danger">{payouts.error.message}</p>;
  if (!payouts.data) return <Spinner />;
  const p = payouts.data;
  const kobo = nairaToKobo(Number(amount) || 0);
  const problem = !amount ? null : !Number.isFinite(Number(amount)) || kobo <= 0 ? "Enter an amount" : kobo > p.balanceKobo ? `That’s more than your balance of ${formatNaira(p.balanceKobo)}` : null;
  const quick = [5000, 10000, 50000].filter((n) => nairaToKobo(n) <= p.balanceKobo);

  return (
    <div className="stack">
      <div className="grid-2 payouts">
        <section className="card balance">
          <span className="balance__label">Available to withdraw</span>
          <span className="balance__value">{formatNaira(p.balanceKobo)}</span>
          {p.heldKobo ? (
            <span className="balance__held">
              <Clock size={15} /> {formatNaira(p.heldKobo)} more is on hold and joins your balance once it clears.
            </span>
          ) : null}

          <div className="balance__form">
            <Input label="Amount to withdraw" prefix="₦" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => (setAmount(e.target.value.replace(/[^\d.]/g, "")), withdraw.reset())} error={problem} />
            {p.balanceKobo > 0 ? (
              <div className="wrap">
                {quick.map((n) => (
                  <button key={n} type="button" className="chip" aria-pressed={Number(amount) === n} onClick={() => setAmount(String(n))}>
                    {formatNaira(nairaToKobo(n))}
                  </button>
                ))}
                <button type="button" className="chip" aria-pressed={kobo === p.balanceKobo} onClick={() => setAmount(String(p.balanceKobo / 100))}>
                  All
                </button>
              </div>
            ) : null}
            <Button block loading={withdraw.isPending} disabled={!p.account || !amount || !!problem} onClick={() => withdraw.mutate()}>
              {kobo > 0 && !problem ? `Withdraw ${formatNaira(kobo)}` : "Withdraw"}
            </Button>
            {!p.account ? <p className="small muted">Add your bank account first, then you can withdraw.</p> : null}
            {withdraw.isError ? <p className="text-danger">{withdraw.error.message}</p> : null}
            {withdraw.isSuccess ? <p className="text-success">Request sent. The Vendo team approves withdrawals, then the money goes to your bank.</p> : null}
          </div>
        </section>

        <section className="card stack">
          <div className="card__head">
            <h2>Bank account</h2>
            <Landmark size={20} color="var(--subtle)" />
          </div>
          {p.account ? (
            <div className="row">
              <div className="avatar">
                <Banknote size={18} />
              </div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="strong">
                  {p.account.bankName} ••••{p.account.accountNumber}
                </div>
                <div className="small muted truncate">{p.account.accountName}</div>
              </div>
            </div>
          ) : (
            <p className="note note--warning">No bank account yet. Add one so we know where to send your money.</p>
          )}
          <div>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {p.account ? "Change account" : "Add bank account"}
            </Button>
          </div>
          <p className="small muted row" style={{ alignItems: "flex-start" }}>
            <ShieldCheck size={16} style={{ flex: "none", marginTop: 2 }} /> We check the account with your bank and only pay to the name it returns.
          </p>
        </section>
      </div>

      <section className="card card--flush">
        <div className="card__head" style={{ padding: "18px 20px 0" }}>
          <h2>Withdrawals</h2>
        </div>
        {p.history.length === 0 ? (
          <Empty icon={<Banknote />} title="No withdrawals yet">
            When you withdraw, each request and what happened to it shows here.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.history.map((h) => {
                  const view = statusView[h.status] ?? { label: h.status.replaceAll("_", " "), hint: "" };
                  return (
                    <tr key={h.id}>
                      <td className="strong">{dayLabel(new Date(h.date))}</td>
                      <td>
                        <Badge tone={view.tone}>{view.label}</Badge>
                        <div className="small muted">{h.note ?? view.hint}</div>
                      </td>
                      <td className="num strong" data-label="Amount">
                        {formatNaira(h.amountKobo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing ? <BankModal current={p.account?.bankCode} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function BankModal({ current, onClose }: { current?: string; onClose: () => void }) {
  const save = useSaveBankAccount();
  const banks = useBanks();
  const [bankCode, setBankCode] = useState(current ?? "");
  const [accountNumber, setNumber] = useState("");
  const valid = !!bankCode && /^\d{10}$/.test(accountNumber);
  return (
    <Modal
      title="Bank account"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate({ bankCode, accountNumber, accountName: "" }, { onSuccess: onClose })}>
            Check and save
          </Button>
        </>
      }>
      <div className="stack">
        <div className="field">
          <label htmlFor="bank">Bank</label>
          <select id="bank" className="select" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
            <option value="">{banks.data ? "Choose your bank" : "Loading banks…"}</option>
            {banks.data?.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <Input label="Account number" inputMode="numeric" maxLength={10} placeholder="10 digits" value={accountNumber} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} hint="We’ll look up the account name with your bank." />
        {save.isError ? <p className="text-danger">{save.error.message}</p> : null}
      </div>
    </Modal>
  );
}
