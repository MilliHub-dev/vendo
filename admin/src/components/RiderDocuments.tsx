"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { request } from "@/api/client";
import type { Row } from "@/api/types";
import { formatDate } from "@/lib/format";

import { EditForm, note, rowId } from "./Workbench";
import { Badge, Button, Spinner } from "./ui";

const kinds: Record<string, string> = { identity: "Government ID", license: "Rider’s licence", vehicle: "Vehicle papers" };
const tones = { approved: "success", rejected: "danger", submitted: "warning" } as const;

/** A rider's uploaded documents. Each must be opened and approved before the rider can be approved. */
export function RiderDocuments({ riderId }: { riderId: string }) {
  const client = useQueryClient();
  const docs = useQuery({ queryKey: ["rider-documents", riderId], queryFn: () => request<Row[]>(`/v1/admin/riders/${riderId}/documents`) });
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [error, setError] = useState("");

  // opens in a new tab; the server records every view in the audit log
  const view = useMutation({
    mutationFn: async (doc: Row) => {
      const tab = window.open("", "_blank");
      try {
        const content = await request<{ mime: string; data_base64: string }>(`/v1/admin/rider-documents/${rowId(doc)}/content`);
        const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(content.data_base64), (c) => c.charCodeAt(0))], { type: content.mime }));
        if (tab) tab.location.href = url;
        else window.location.assign(url);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (e) {
        tab?.close();
        throw e;
      }
    },
    onMutate: () => setError(""),
    onError: (e) => setError(e.message),
  });
  const approve = useMutation({
    mutationFn: (doc: Row) => request(`/v1/admin/rider-documents/${rowId(doc)}/review`, "POST", { status: "approved", note: "Document checked and approved." }, true, crypto.randomUUID()),
    onMutate: () => setError(""),
    onSuccess: () => client.invalidateQueries(),
    onError: (e) => setError(e.message),
  });

  if (docs.isPending) return <Spinner />;
  if (docs.isError) return <p role="alert" className="note note--danger">{docs.error.message}</p>;
  const waiting = docs.data.filter((d) => d.status !== "approved").length;

  return (
    <div className="stack">
      <h3>Documents</h3>
      <p className="note small">
        {docs.data.length === 0
          ? "This rider hasn’t uploaded any documents yet, so they can’t be approved."
          : waiting
            ? `${waiting} of ${docs.data.length} still to approve. View each one, then approve or reject it. The rider can only be approved once every document is approved.`
            : "All documents are approved. You can now approve the rider with “Review rider”."}
      </p>
      {docs.data.map((doc) => {
        const status = String(doc.status);
        const busy = (approve.isPending && approve.variables === doc) || (view.isPending && view.variables === doc);
        return (
          <div key={rowId(doc)} className="doc-row">
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="strong">{kinds[String(doc.kind)] ?? String(doc.kind)}</div>
              <div className="small muted truncate">
                Uploaded {formatDate(String(doc.created_at))}
                {doc.review_note && status === "rejected" ? ` · ${String(doc.review_note)}` : ""}
              </div>
            </div>
            <Badge tone={tones[status as keyof typeof tones]}>{status === "submitted" ? "To review" : status.replace(/^./, (c) => c.toUpperCase())}</Badge>
            <div className="doc-row__actions">
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => view.mutate(doc)}>
                View
              </Button>
              {status !== "approved" ? (
                <Button size="sm" loading={approve.isPending && approve.variables === doc} onClick={() => approve.mutate(doc)}>
                  Approve
                </Button>
              ) : null}
              {status !== "rejected" ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(doc)}>
                  Reject
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
      {error ? <p role="alert" className="note note--danger">{error}</p> : null}
      {rejecting ? (
        <EditForm
          action={{ label: "Reject document", path: `/v1/admin/rider-documents/${rowId(rejecting)}/review`, fields: [{ ...note, label: "Why is it rejected?", hint: "At least 10 characters. The rider sees this and is asked to upload it again." }], transform: (v) => ({ ...v, status: "rejected" }), danger: true }}
          onClose={() => setRejecting(null)}
        />
      ) : null}
    </div>
  );
}
