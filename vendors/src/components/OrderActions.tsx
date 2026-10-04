"use client";

import { useState } from "react";

import { Button, Modal } from "./ui";

const PREP_TIMES = [10, 15, 20, 30, 45];
const REASONS = ["An item is out of stock", "Too busy right now", "Closing soon", "Something else"];

/** Accepting means promising a time: the rider is sent to arrive when the food is ready. */
export function PrepTimeModal({ loading, error, onClose, onConfirm }: { loading: boolean; error?: string | null; onClose: () => void; onConfirm: (minutes: number) => void }) {
  const [minutes, setMinutes] = useState(20);
  return (
    <Modal
      title="How long to prepare?"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={() => onConfirm(minutes)}>
            Accept · ready in {minutes} min
          </Button>
        </>
      }>
      <p className="muted">The rider is timed to arrive when the order is ready, so be realistic.</p>
      <div className="wrap" role="radiogroup" aria-label="Preparation time">
        {PREP_TIMES.map((m) => (
          <button key={m} type="button" role="radio" className="chip" aria-checked={minutes === m} onClick={() => setMinutes(m)}>
            {m} min
          </button>
        ))}
      </div>
      {error ? <p className="text-danger">{error}</p> : null}
    </Modal>
  );
}

export function RejectModal({ loading, error, onClose, onConfirm }: { loading: boolean; error?: string | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  return (
    <Modal
      title="Reject this order?"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep order
          </Button>
          <Button variant="danger" loading={loading} onClick={() => onConfirm(reason)}>
            Reject order
          </Button>
        </>
      }>
      <p className="muted">The customer is refunded in full. Rejecting often lowers your store’s ranking.</p>
      <div className="stack-sm" role="radiogroup" aria-label="Reason">
        {REASONS.map((r) => (
          <label key={r} className="row" style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", cursor: "pointer" }}>
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      {error ? <p className="text-danger">{error}</p> : null}
    </Modal>
  );
}
