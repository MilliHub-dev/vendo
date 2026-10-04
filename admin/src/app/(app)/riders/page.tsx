"use client";

import { Bike, FileCheck2, FileClock, FileX2 } from "lucide-react";
import { useState } from "react";

import { api } from "@/api/client";
import { useAction, useRiders } from "@/api/queries";
import type { DocumentKind, Rider } from "@/api/types";
import { ActionModal, ApprovalBadge, CitySelect, ExportButton, KV, Locked, SearchBox, Tabs, WalletAdjust, useCan, useCityName } from "@/components/admin";
import { Badge, Button, Empty, Modal, Spinner } from "@/components/ui";
import { dayLabel } from "@/lib/dates";
import { formatNaira } from "@/lib/money";

const docLabel: Record<DocumentKind, string> = { gov_id: "Government ID", bike_registration: "Bike registration", photo: "Photo" };
const docIcon = { submitted: FileClock, approved: FileCheck2, rejected: FileX2 };
const presenceLabel = { offline: "Offline", online: "Online", on_trip: "On a trip" };

function Docs({ rider }: { rider: Rider }) {
  return (
    <div className="docs">
      {rider.documents.map((d) => {
        const Icon = docIcon[d.status];
        return (
          <span key={d.kind} className="doc" data-status={d.status} title={d.status}>
            <Icon /> {docLabel[d.kind]}
          </span>
        );
      })}
    </div>
  );
}

export default function RidersPage() {
  const { data } = useRiders();
  const cityName = useCityName();
  const canReview = useCan("riders.review");
  const [tab, setTab] = useState<"queue" | "all" | "map">("queue");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Rider | null>(null);
  const approve = useAction((id: string) => api.reviewRider(id, "approve", ""), ["riders"]);

  if (!data) return <Spinner />;
  const queue = data.filter((r) => r.approval === "pending");
  const q = query.trim().toLowerCase();
  const rows = data.filter((r) => r.approval !== "pending" && (!city || r.cityId === city) && (!q || [r.name, r.phone, r.plateNumber].some((v) => v.toLowerCase().includes(q))));
  const open = data.find((r) => r.id === openId);

  return (
    <>
      <Tabs
        label="Riders"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "queue", label: "Applications", count: queue.length, alert: true },
          { value: "all", label: "All riders" },
          { value: "map", label: "Live map" },
        ]}
      />

      {tab === "queue" ? (
        queue.length === 0 ? (
          <section className="card">
            <Empty icon={<Bike />} title="No applications waiting">
              New rider applications show here for review.
            </Empty>
          </section>
        ) : (
          <>
            {!canReview ? <Locked permission="riders.review" what="approve or reject riders" /> : null}
            {approve.isError ? <p className="note note--danger">{approve.error.message}</p> : null}
            <div className="cards">
              {queue.map((r) => (
                <article key={r.id} className="card stack">
                  <div className="row">
                    <div className="avatar">{r.name.slice(0, 1)}</div>
                    <div className="grow">
                      <div className="strong">{r.name}</div>
                      <div className="small muted">{r.phone} · {cityName(r.cityId)}</div>
                    </div>
                  </div>
                  <KV rows={[["Vehicle", r.vehicle], ["Plate", r.plateNumber], ["Applied", dayLabel(new Date(r.joinedAt))]]} />
                  <Docs rider={r} />
                  {canReview ? (
                    <div className="row">
                      <Button size="sm" className="grow" loading={approve.isPending && approve.variables === r.id} onClick={() => approve.mutate(r.id)}>Approve</Button>
                      <Button size="sm" variant="secondary" className="grow" onClick={() => setRejecting(r)}>Reject</Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )
      ) : null}

      {tab === "all" ? (
        <>
          <div className="toolbar">
            <SearchBox value={query} onChange={setQuery} placeholder="Search name, phone or plate" />
            <CitySelect value={city} onChange={setCity} />
            <span className="grow" />
            <ExportButton rows={rows} filename="vendo-riders.csv" columns={[["Name", (r) => r.name], ["Phone", (r) => r.phone], ["City", (r) => cityName(r.cityId)], ["Status", (r) => r.approval], ["Trips", (r) => r.trips], ["Rating", (r) => r.rating], ["Acceptance", (r) => `${Math.round(r.acceptanceRate * 100)}%`], ["Wallet (NGN)", (r) => r.balanceKobo / 100]]} />
          </div>
          <section className="card card--flush">
            {rows.length === 0 ? (
              <Empty icon={<Bike />} title="No riders match">Try a different city or search.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rider</th>
                      <th>Status</th>
                      <th>City</th>
                      <th className="num">Trips</th>
                      <th className="num">Rating</th>
                      <th className="num">Accepts</th>
                      <th className="num">Wallet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="clickable" onClick={() => setOpenId(r.id)}>
                        <td>
                          <button type="button" className="strong" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>{r.name}</button>
                          <div className="small muted">{r.phone}</div>
                        </td>
                        <td>
                          {r.approval === "approved" ? <Badge tone={r.presence === "offline" ? undefined : r.presence === "online" ? "success" : "primary"}>{presenceLabel[r.presence]}</Badge> : <ApprovalBadge status={r.approval} />}
                        </td>
                        <td data-label="City">{cityName(r.cityId)}</td>
                        <td className="num" data-label="Trips">{r.trips}</td>
                        <td className="num" data-label="Rating">{r.rating ? `${r.rating.toFixed(1)} ★` : "—"}</td>
                        <td className="num" data-label="Accepts">{Math.round(r.acceptanceRate * 100)}%</td>
                        <td className="num strong" data-label="Wallet">{formatNaira(r.balanceKobo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {tab === "map" ? <LiveMap riders={data} onOpen={setOpenId} /> : null}

      {open ? <RiderDrawer rider={open} onClose={() => setOpenId(null)} /> : null}
      {rejecting ? <ActionModal title={`Reject ${rejecting.name}?`} intro="The rider sees this reason in their app and can fix it and apply again." confirmLabel="Reject application" danger reasonLabel="What needs fixing" refresh={["riders"]} run={({ reason }) => api.reviewRider(rejecting.id, "reject", reason)} onClose={() => setRejecting(null)} /> : null}
    </>
  );
}

function LiveMap({ riders, onOpen }: { riders: Rider[]; onOpen: (id: string) => void }) {
  const cityName = useCityName();
  const [city, setCity] = useState("kaduna");
  const [selected, setSelected] = useState<string | null>(null);
  const live = riders.filter((r) => r.cityId === city && r.presence !== "offline");
  const sel = live.find((r) => r.id === selected);
  return (
    <section className="card stack">
      <div className="between wrap">
        <div className="legend">
          <span><i />Online, free ({live.filter((r) => r.presence === "online").length})</span>
          <span><i data-k="on_trip" />On a trip ({live.filter((r) => r.presence === "on_trip").length})</span>
        </div>
        <CitySelect value={city} onChange={(v) => (setCity(v), setSelected(null))} all={false} />
      </div>
      <div className="map" role="group" aria-label={`Riders online in ${cityName(city)}`}>
        {live.map((r) => (
          <button key={r.id} type="button" className="map__pin" data-presence={r.presence} aria-pressed={selected === r.id} aria-label={`${r.name}, ${presenceLabel[r.presence]}`} style={{ left: `${r.position.x * 100}%`, top: `${r.position.y * 100}%` }} onClick={() => setSelected(r.id)}>
            <Bike />
          </button>
        ))}
        {sel ? (
          <div className="map__card row">
            <div>
              <div className="strong">{sel.name}</div>
              <div className="small muted">{presenceLabel[sel.presence]} · {sel.rating.toFixed(1)} ★ · {sel.plateNumber}</div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onOpen(sel.id)}>Details</Button>
          </div>
        ) : null}
      </div>
      <p className="small muted">This is a drawn placeholder: positions are sample data. The real map (Mapbox, with live rider locations) comes when the server is connected.</p>
    </section>
  );
}

function RiderDrawer({ rider: r, onClose }: { rider: Rider; onClose: () => void }) {
  const cityName = useCityName();
  const canReview = useCan("riders.review");
  const canAdjust = useCan("wallet.adjust");
  const [action, setAction] = useState<"suspend" | "wallet" | "reject" | null>(null);
  const act = useAction((kind: "reinstate" | "approve") => (kind === "approve" ? api.reviewRider(r.id, "approve", "") : api.setRiderSuspended(r.id, false, "")), ["riders"]);
  return (
    <Modal title={r.name} side onClose={onClose}>
      <div className="stack">
        <div className="row wrap">
          <ApprovalBadge status={r.approval} />
          {r.approval === "approved" ? <Badge tone={r.presence === "offline" ? undefined : "success"}>{presenceLabel[r.presence]}</Badge> : null}
        </div>
        {r.note ? <p className="note note--warning">{r.note}</p> : null}
        <section className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="card stat"><span className="stat__label">Trips</span><span className="stat__value">{r.trips}</span></div>
          <div className="card stat"><span className="stat__label">Rating</span><span className="stat__value">{r.rating ? r.rating.toFixed(1) : "—"}</span></div>
          <div className="card stat"><span className="stat__label">Accepts</span><span className="stat__value">{Math.round(r.acceptanceRate * 100)}%</span></div>
        </section>
        <KV rows={[["Phone", <a key="p" href={`tel:${r.phone}`} className="text-primary">{r.phone}</a>], ["City", cityName(r.cityId)], ["Vehicle", r.vehicle], ["Plate", r.plateNumber], ["Joined", dayLabel(new Date(r.joinedAt))], ["Wallet", <strong key="w" className="strong">{formatNaira(r.balanceKobo)}</strong>]]} />
        <div className="stack-sm">
          <h3 className="label">Documents</h3>
          <Docs rider={r} />
        </div>
        <div className="stack-sm">
          <h3 className="label">Actions</h3>
          {canReview ? (
            <div className="wrap">
              {r.approval === "approved" ? <Button variant="danger" size="sm" onClick={() => setAction("suspend")}>Suspend rider</Button> : null}
              {r.approval === "suspended" ? <Button size="sm" loading={act.isPending} onClick={() => act.mutate("reinstate")}>Lift suspension</Button> : null}
              {r.approval === "rejected" ? <Button size="sm" loading={act.isPending} onClick={() => act.mutate("approve")}>Approve after all</Button> : null}
            </div>
          ) : (
            <Locked permission="riders.review" what="suspend or approve riders" />
          )}
          {canAdjust ? <div><Button variant="secondary" size="sm" onClick={() => setAction("wallet")}>Adjust wallet</Button></div> : <Locked permission="wallet.adjust" what="adjust wallets" />}
          {act.isError ? <p className="text-danger">{act.error.message}</p> : null}
        </div>
      </div>
      {action === "suspend" ? <ActionModal title={`Suspend ${r.name}?`} intro="They go offline at once and can’t take trips until the suspension is lifted. Their wallet balance is kept." confirmLabel="Suspend" danger refresh={["riders"]} run={({ reason }) => api.setRiderSuspended(r.id, true, reason)} onClose={() => setAction(null)} /> : null}
      {action === "wallet" ? <WalletAdjust party="rider" id={r.id} name={r.name} balanceKobo={r.balanceKobo} refresh={["riders"]} onClose={() => setAction(null)} /> : null}
    </Modal>
  );
}
