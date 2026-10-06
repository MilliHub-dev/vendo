"use client";

import { ChevronLeft, ChevronRight, Download, Inbox, MoreHorizontal, Plus, RefreshCw, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, request } from "@/api/client";
import { useCities } from "@/api/queries";
import type { Row } from "@/api/types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatValue, labelOf, textOf } from "@/lib/format";

import { Button, Confirm, Empty, Input, Modal, Spinner, Switch } from "./ui";

export type Field = { key: string; label: string; type?: "text" | "number" | "boolean" | "select" | "json" | "cities" | "datetime-local" | "money"; options?: string[]; nullable?: boolean; optional?: boolean; min?: number; max?: number; value?: unknown; hint?: string };
export type Action = { label: string; path: string | ((row: Row) => string); method?: string; fields?: Field[]; initial?: (row: Row) => Row; transform?: (value: Row, row: Row) => Row; show?: (row: Row) => boolean; detail?: string; danger?: boolean };
export type Dataset = { label: string; resource?: string; path?: string; columns: string[]; actions?: Action[]; create?: Action; id?: string };

export const text = (v: unknown): string => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
export const rowId = (r: Row) => String(r.id ?? r.profile_id);
export const field = (key: string, label: string, type: Field["type"] = "text", extra: Partial<Field> = {}): Field => ({ key, label, type, ...extra });
export const reason = field("reason", "Reason", "text", { hint: "At least 10 characters. Saved to the audit log." });
export const note = field("note", "Review note", "text", { hint: "At least 10 characters. The person concerned may see this." });
/** An amount. Staff type naira; the API is sent kobo. */
export const money = (key: string, label: string) => field(key, label, "money", { min: 0 });

const PAGE_SIZE = 50;
/** Columns of counts and amounts line up on the right. */
const isNumeric = (key: string) => /_kobo$|_30d$|^(orders|trips|menu_items|recipients|paid_orders|delivered|cancelled|used_count|max_uses|device_sends|inbox_reads)$/.test(key);
const singular = (label: string) => label.replace(/ies$/, "y").replace(/([^s])s$/, "$1");
const words = (v: string) => v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const localInput = (iso: unknown) => (iso ? new Date(Date.parse(String(iso)) - new Date(String(iso)).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

/** City names by ID, so tables can say "Kaduna" instead of an ID. */
function useCityNames(): Record<string, string> {
  const cities = useCities();
  return Object.fromEntries((cities.data ?? []).map((c) => [String(c.id), String(c.name)]));
}

// ---------------------------------------------------------------- form

export function EditForm({ action, row = {}, onClose }: { action: Action; row?: Row; onClose: () => void }) {
  const initial = action.initial?.(row) ?? row;
  const fields = action.fields ?? [];
  const [values, setValues] = useState<Row>(() =>
    Object.fromEntries(
      fields.map((f) => {
        const start = initial[f.key] ?? f.value;
        if (f.type === "datetime-local") return [f.key, localInput(initial[f.key])];
        if (f.type === "money") return [f.key, start === undefined || start === null || start === "" ? "" : String(Number(start) / 100)];
        return [f.key, start ?? (f.type === "boolean" ? false : "")];
      }),
    ),
  );
  const [confirming, setConfirming] = useState(false);
  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));
  const reach = useQuery({
    queryKey: ["campaign-reach", values.audience, values.city_ids],
    queryFn: () => request<{ recipients: number }>("/v1/admin/broadcasts/count", "POST", { audience: values.audience, city_ids: values.city_ids }),
    enabled: action.path === "/v1/admin/broadcasts" && !!values.audience && Array.isArray(values.city_ids) && values.city_ids.length > 0,
  });
  const cities = useCities();
  const keys = useRef(new Map<string, string>());
  const client = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const body: Row = {};
      for (const f of fields) {
        const value = values[f.key];
        if ((value === "" || value == null) && (f.optional || f.nullable)) {
          if (f.nullable) body[f.key] = null;
          continue;
        }
        body[f.key] =
          f.type === "number" ? Number(value)
          : f.type === "money" ? Math.round(Number(value) * 100)
          : f.type === "json" ? (typeof value === "object" ? value : JSON.parse(String(value)))
          : f.type === "datetime-local" ? new Date(String(value)).toISOString()
          : value;
      }
      const payload = action.transform?.(body, row) ?? body;
      const path = typeof action.path === "function" ? action.path(row) : action.path;
      // the same submission retried (double click, flaky network) reuses its key, so it is never applied twice
      const fingerprint = JSON.stringify({ path, payload });
      let key = keys.current.get(fingerprint);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(fingerprint, key);
      }
      const result = await request(path, action.method ?? "POST", payload, true, key);
      keys.current.delete(fingerprint);
      return result;
    },
    onSuccess: () => {
      client.invalidateQueries();
      onClose();
    },
    onError: () => setConfirming(false),
  });

  const control = (f: Field) => {
    const required = !f.optional && !f.nullable;
    const label = f.key === "city_id" ? f.label.replace(/ ID\b.*/, "") : f.label;
    if (f.type === "cities")
      return (
        <div key={f.key} className="field field--wide">
          <span className="label">{label}</span>
          <div className="wrap">
            {cities.data?.filter((c) => c.is_active).map((c) => {
              const id = String(c.id);
              const chosen = Array.isArray(values[f.key]) ? (values[f.key] as string[]) : [];
              return (
                <button key={id} type="button" className="chip" aria-pressed={chosen.includes(id)} onClick={() => set(f.key, chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])}>
                  {String(c.name)}
                </button>
              );
            })}
          </div>
          {cities.isError ? <span className="field__error">{cities.error.message}</span> : null}
        </div>
      );
    if (f.key === "city_id")
      return (
        <label key={f.key} className="field">
          <span>{label}</span>
          <select className="select" required={required} value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">{f.nullable ? "All cities" : "Select a city…"}</option>
            {cities.data?.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.name)}
              </option>
            ))}
          </select>
        </label>
      );
    if (f.type === "boolean")
      return (
        <div key={f.key} className="field field--switch">
          <span>{label}</span>
          <Switch checked={!!values[f.key]} onChange={(next) => set(f.key, next)} label={label} />
        </div>
      );
    if (f.type === "select")
      return (
        <label key={f.key} className="field">
          <span>{label}</span>
          <select className="select" required={required} value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">Select…</option>
            {f.options?.map((v) => (
              <option key={v} value={v}>
                {words(v)}
              </option>
            ))}
          </select>
        </label>
      );
    if (f.type === "json")
      return (
        <label key={f.key} className="field field--wide">
          <span>{label}</span>
          <textarea className="textarea mono" rows={4} required={required} value={typeof values[f.key] === "object" ? JSON.stringify(values[f.key], null, 2) : String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
          {f.hint ? <span className="field__hint">{f.hint}</span> : null}
        </label>
      );
    if (f.type === "money") return <Input key={f.key} label={label} prefix="₦" inputMode="decimal" type="number" step="0.01" min={f.min === undefined ? undefined : f.min / 100} required={required} hint={f.hint} value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />;
    return <Input key={f.key} label={label} type={f.type ?? "text"} required={required} min={f.min} max={f.max} step={f.type === "number" ? "any" : undefined} hint={f.hint} value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />;
  };

  return (
    <Modal title={action.label} wide onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (action.danger) setConfirming(true);
          else save.mutate();
        }}>
        {action.detail ? <p className="note">{action.detail}</p> : null}
        <div className="form-grid">{fields.map(control)}</div>
        {action.path === "/v1/admin/broadcasts" ? (
          <p className="note small">{reach.isError ? reach.error.message : reach.data ? `About ${reach.data.recipients.toLocaleString("en-NG")} accounts will receive this. Recipients are checked again when it is sent.` : reach.isFetching ? "Counting recipients…" : "Choose an audience and cities to see how many people this reaches."}</p>
        ) : null}
        {save.isError ? (
          <p role="alert" className="note note--danger">
            {save.error.message}
          </p>
        ) : null}
        <div className="modal__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} variant={action.danger ? "danger" : "primary"}>
            {action.label}
          </Button>
        </div>
      </form>
      {confirming ? <Confirm title={`${action.label}?`} message="Please confirm. This is recorded in the audit log and may not be reversible." confirmLabel={action.label} danger loading={save.isPending} onClose={() => setConfirming(false)} onConfirm={() => save.mutate()} /> : null}
    </Modal>
  );
}

// ---------------------------------------------------------------- row actions

/** "Details" plus a ⋯ menu of what can be done to this row, so wide tables stay readable. */
function RowActions({ actions, onOpen, onAction }: { actions: Action[]; onOpen: () => void; onAction: (a: Action) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="row-actions" ref={ref}>
      <Button variant="secondary" size="sm" onClick={onOpen}>
        Details
      </Button>
      {actions.length === 1 && !actions[0].danger ? (
        <Button variant="secondary" size="sm" onClick={() => onAction(actions[0])}>
          {actions[0].label}
        </Button>
      ) : actions.length > 0 ? (
        <>
          <button type="button" className="icon-btn icon-btn--sm" aria-label="More actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <MoreHorizontal />
          </button>
          {open ? (
            <div className="menu" role="menu">
              {actions.map((a) => (
                <button key={a.label} type="button" role="menuitem" data-danger={a.danger || undefined} onClick={() => (setOpen(false), onAction(a))}>
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- table

export function Workbench({ datasets, description, detail }: { datasets: Dataset[]; description?: string; detail?: (row: Row, tab: Dataset) => ReactNode }) {
  const [tabIndex, setTabIndex] = useState(0);
  // `?tab=applications` opens that tab, so a "waiting for review" link lands on the queue itself
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab")?.toLowerCase();
    const i = wanted ? datasets.findIndex((d) => d.label.toLowerCase().replace(/\s+/g, "-") === wanted) : -1;
    if (i > 0) setTabIndex(i);
  }, []);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [editing, setEditing] = useState<{ action: Action; row: Row } | null>(null);
  const tab = datasets[tabIndex];
  const names = useCityNames();
  const data = useQuery({
    queryKey: ["admin-data", tab.resource ?? tab.path, tab.id, offset],
    queryFn: async () => (tab.resource ? (await api.data(tab.resource, offset, tab.id)).items : api.list(tab.path!, offset)),
    refetchInterval: 15000,
  });
  const q = search.trim().toLowerCase();
  const rows = (data.data ?? []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q));
  const loaded = data.data?.length ?? 0;
  // the first column is the row's "name"; on phones each row becomes a card with it as the heading
  // …so a name, title or code leads when there is one, and the raw ID stays in the details panel
  const naming = tab.columns.find((k) => ["name", "title", "subject", "code"].includes(k));
  const columns = naming ? [naming, ...tab.columns.filter((k) => k !== naming && k !== "id")] : tab.columns;
  const [lead, ...rest] = columns;

  return (
    <div className="stack">
      {description ? <p className="muted page-intro">{description}</p> : null}
      {datasets.length > 1 ? (
        <div className="tabs" role="tablist">
          {datasets.map((d, i) => (
            <button key={d.label} type="button" role="tab" className="chip" aria-selected={i === tabIndex} onClick={() => (setTabIndex(i), setOffset(0), setSelected(null), setSearch(""))}>
              {d.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="toolbar">
        <label className="search">
          <Search />
          <input className="input" type="search" placeholder={`Search ${tab.label.toLowerCase()} on this page`} aria-label={`Search ${tab.label}`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <span className="grow" />
        <Button variant="secondary" size="sm" onClick={() => data.refetch()} aria-label="Refresh">
          <RefreshCw className={data.isFetching ? "spin" : undefined} /> <span className="hide-sm">Refresh</span>
        </Button>
        <Button variant="secondary" size="sm" disabled={!rows.length} onClick={() => downloadCsv(`vendo-${tab.label.toLowerCase().replaceAll(" ", "-")}.csv`, toCsv(tab.columns.map(labelOf), rows.map((r) => tab.columns.map((k) => textOf(r[k])))))} aria-label="Export CSV">
          <Download /> <span className="hide-sm">Export</span>
        </Button>
        {tab.create ? (
          <Button size="sm" onClick={() => setEditing({ action: tab.create!, row: {} })}>
            <Plus /> {tab.create.label}
          </Button>
        ) : null}
      </div>

      {data.isError ? (
        <div className="card stack">
          <p role="alert" className="text-danger">
            {data.error.message}
          </p>
          <div>
            <Button onClick={() => data.refetch()}>Try again</Button>
          </div>
        </div>
      ) : !data.data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <section className="card">
          <Empty icon={<Inbox />} title={q ? "Nothing matches your search" : `No ${tab.label.toLowerCase()} yet`}>
            {q ? "Search only looks at the records on this page. Try another word, or go to the next page." : "Records will show here as soon as there are some."}
          </Empty>
        </section>
      ) : (
        <section className="card card--flush">
          <div className="table-wrap">
            <table className="table table--data">
              <thead>
                <tr>
                  {columns.map((k) => (
                    <th key={k} className={isNumeric(k) ? "num" : undefined}>
                      {labelOf(k)}
                    </th>
                  ))}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={rowId(r) === "undefined" ? i : rowId(r)}>
                    <td className="lead">{formatValue(lead, r[lead], names)}</td>
                    {rest.map((k) => (
                      <td key={k} data-label={labelOf(k)} className={isNumeric(k) ? "num" : undefined}>
                        {formatValue(k, r[k], names)}
                      </td>
                    ))}
                    <td className="actions">
                      <RowActions actions={(tab.actions ?? []).filter((a) => !a.show || a.show(r))} onOpen={() => setSelected(r)} onAction={(action) => setEditing({ action, row: r })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table__foot between">
            <span className="small muted">
              {offset + 1}–{offset + loaded}
              {q ? ` · ${rows.length} match${rows.length === 1 ? "" : "es"}` : ""}
            </span>
            <div className="row">
              <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} aria-label="Previous page">
                <ChevronLeft /> <span className="hide-sm">Previous</span>
              </Button>
              <Button variant="secondary" size="sm" disabled={loaded < PAGE_SIZE || offset >= 10000} onClick={() => setOffset(offset + PAGE_SIZE)} aria-label="Next page">
                <span className="hide-sm">Next</span> <ChevronRight />
              </Button>
            </div>
          </div>
        </section>
      )}

      {selected ? (
        <Modal title={`${singular(tab.label)} details`} side onClose={() => setSelected(null)}>
          <div className="stack">
            <dl className="kv">
              {Object.entries(selected).map(([k, v]) => (
                <div key={k}>
                  <dt>{labelOf(k)}</dt>
                  <dd>{formatValue(k, v, names, true)}</dd>
                </div>
              ))}
            </dl>
            {(tab.actions ?? []).filter((a) => !a.show || a.show(selected)).length ? (
              <div className="wrap">
                {(tab.actions ?? []).filter((a) => !a.show || a.show(selected)).map((a) => (
                  <Button key={a.label} size="sm" variant={a.danger ? "danger" : "secondary"} onClick={() => setEditing({ action: a, row: selected })}>
                    {a.label}
                  </Button>
                ))}
              </div>
            ) : null}
            {detail?.(selected, tab)}
          </div>
        </Modal>
      ) : null}
      {editing ? <EditForm action={editing.action} row={editing.row} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
