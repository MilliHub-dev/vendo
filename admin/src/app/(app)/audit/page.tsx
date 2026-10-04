"use client";

import { History } from "lucide-react";
import { useState } from "react";

import { useAudit } from "@/api/queries";
import { ExportButton, Locked, SearchBox, useCan } from "@/components/admin";
import { Badge, Empty, Spinner } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { roleLabel } from "@/lib/permissions";

export default function AuditPage() {
  const allowed = useCan("audit.view");
  const { data } = useAudit(allowed);
  const [query, setQuery] = useState("");
  if (!allowed) return <Locked permission="audit.view" what="see the audit log" />;
  if (!data) return <Spinner />;
  const q = query.trim().toLowerCase();
  const rows = data.filter((a) => !q || [a.admin, a.action, a.target, a.detail].some((v) => v.toLowerCase().includes(q)));
  return (
    <>
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search staff, action or target" />
        <span className="grow" />
        <ExportButton rows={rows} filename="vendo-audit-log.csv" columns={[["When", (a) => a.at], ["Staff", (a) => a.admin], ["Role", (a) => roleLabel[a.role]], ["Action", (a) => a.action], ["Target", (a) => a.target], ["Detail", (a) => a.detail]]} />
      </div>
      <p className="small muted">Every change made in this dashboard is recorded here with who did it and why. Entries can’t be edited or deleted.</p>
      <section className="card card--flush">
        {rows.length === 0 ? (
          <Empty icon={<History />} title="Nothing matches">Try a different search.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Staff</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(a.at)}</td>
                    <td>
                      <span className="strong">{a.admin}</span> <Badge>{roleLabel[a.role]}</Badge>
                    </td>
                    <td className="strong">{a.action}</td>
                    <td data-label="Target">{a.target}</td>
                    <td className="muted" data-label="Detail">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
