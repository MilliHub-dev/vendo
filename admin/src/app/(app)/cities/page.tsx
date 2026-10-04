"use client";

import { useState } from "react";

import { api } from "@/api/client";
import { useAction, useCities } from "@/api/queries";
import type { City } from "@/api/types";
import { KV, Locked, useCan } from "@/components/admin";
import { Badge, Button, Input, Modal, Spinner, Switch } from "@/components/ui";
import { formatNaira, nairaToKobo } from "@/lib/money";

export default function CitiesPage() {
  const { data } = useCities();
  const canManage = useCan("cities.manage");
  const [editing, setEditing] = useState<City | null>(null);
  const toggle = useAction(({ id, ...update }: { id: string; isActive?: boolean; surgeOn?: boolean }) => api.updateCity(id, update), ["cities"]);
  if (!data) return <Spinner />;
  return (
    <>
      {!canManage ? <Locked permission="cities.manage" what="change cities or pricing" /> : null}
      {toggle.isError ? <p className="note note--danger">{toggle.error.message}</p> : null}
      <div className="cards">
        {data.map((c) => (
          <article key={c.id} className="card stack">
            <div className="between">
              <div>
                <h2>{c.name}</h2>
                <div className="row wrap" style={{ marginTop: 6 }}>
                  <Badge tone={c.isActive ? "success" : undefined}>{c.isActive ? "Live" : "Not live"}</Badge>
                  {c.surgeOn ? <Badge tone="warning">Surge {c.surgeMultiplier}×</Badge> : null}
                </div>
              </div>
              <Switch checked={c.isActive} disabled={!canManage || toggle.isPending} label={`${c.name} is live`} onChange={(isActive) => toggle.mutate({ id: c.id, isActive })} />
            </div>
            <KV rows={[["Base fare", formatNaira(c.baseFareKobo)], ["Per km", formatNaira(c.perKmKobo)], ["Minimum order", formatNaira(c.minOrderKobo)], ["Hours", `${c.opensAt} – ${c.closesAt}`]]} />
            <div className="between note">
              <span className="small">
                <strong className="strong">Surge pricing</strong>
                <br />
                <span className="muted">Delivery fees × {c.surgeMultiplier} while on</span>
              </span>
              <Switch checked={c.surgeOn} disabled={!canManage || toggle.isPending} label={`Surge pricing in ${c.name}`} onChange={(surgeOn) => toggle.mutate({ id: c.id, surgeOn })} />
            </div>
            {canManage ? <Button variant="secondary" size="sm" onClick={() => setEditing(c)}>Edit pricing and hours</Button> : null}
          </article>
        ))}
      </div>
      <p className="small muted">Example: a 5 km delivery costs base fare + 5 × per-km rate, times the surge multiplier while surge is on.</p>
      {editing ? <CityForm city={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function CityForm({ city, onClose }: { city: City; onClose: () => void }) {
  const [base, setBase] = useState(String(city.baseFareKobo / 100));
  const [perKm, setPerKm] = useState(String(city.perKmKobo / 100));
  const [min, setMin] = useState(String(city.minOrderKobo / 100));
  const [surge, setSurge] = useState(String(city.surgeMultiplier));
  const [opensAt, setOpensAt] = useState(city.opensAt);
  const [closesAt, setClosesAt] = useState(city.closesAt);
  const [touched, setTouched] = useState(false);
  const save = useAction(() => api.updateCity(city.id, { baseFareKobo: nairaToKobo(Number(base)), perKmKobo: nairaToKobo(Number(perKm)), minOrderKobo: nairaToKobo(Number(min)), surgeMultiplier: Number(surge), opensAt, closesAt }), ["cities"]);
  const money = (v: string) => (v === "" || Number.isNaN(Number(v)) || Number(v) < 0 ? "Enter an amount" : null);
  const errors = { base: money(base), perKm: money(perKm), min: money(min), surge: !(Number(surge) >= 1 && Number(surge) <= 3) ? "Between 1 and 3" : null, hours: opensAt >= closesAt ? "Closing must be after opening" : null };
  const valid = Object.values(errors).every((e) => !e);
  const num = (set: (v: string) => void) => (e: { target: { value: string } }) => set(e.target.value.replace(/[^\d.]/g, ""));
  const example = (nairaToKobo(Number(base) || 0) + 5 * nairaToKobo(Number(perKm) || 0));
  return (
    <Modal
      title={`${city.name} pricing and hours`}
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => (setTouched(true), valid && save.mutate(undefined, { onSuccess: onClose }))}>Save changes</Button>
        </>
      }>
      <div className="stack">
        <div className="form-grid">
          <Input label="Base fare" prefix="₦" inputMode="decimal" value={base} onChange={num(setBase)} error={touched ? errors.base : null} />
          <Input label="Per km" prefix="₦" inputMode="decimal" value={perKm} onChange={num(setPerKm)} error={touched ? errors.perKm : null} />
          <Input label="Minimum food order" prefix="₦" inputMode="decimal" value={min} onChange={num(setMin)} error={touched ? errors.min : null} />
          <Input label="Surge multiplier" inputMode="decimal" value={surge} onChange={num(setSurge)} error={touched ? errors.surge : null} hint="Applied only while surge is switched on" />
          <Input label="Opens" type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          <Input label="Closes" type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} error={touched ? errors.hours : null} />
        </div>
        <p className="note small">With these prices a 5 km delivery costs <strong className="strong">{formatNaira(example)}</strong>, or <strong className="strong">{formatNaira(Math.round(example * (Number(surge) || 1)))}</strong> during surge. New prices apply to new orders only.</p>
        {save.isError ? <p className="text-danger">{save.error.message}</p> : null}
      </div>
    </Modal>
  );
}
