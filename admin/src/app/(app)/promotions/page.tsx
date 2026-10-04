"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { api } from "@/api/client";
import { useAction, useBanners, useCities, usePromoCodes, useReferralConfig } from "@/api/queries";
import type { Banner, PromoCode, ReferralConfig } from "@/api/types";
import { Locked, useCan, useCityName } from "@/components/admin";
import { Badge, Button, Input, Modal, Spinner, Switch } from "@/components/ui";
import { dayLabel } from "@/lib/dates";
import { formatNaira, nairaToKobo } from "@/lib/money";

const promoValue = (p: Pick<PromoCode, "kind" | "value">) => (p.kind === "percent" ? `${p.value}% off` : p.kind === "amount" ? `${formatNaira(p.value)} off` : "Free delivery");
const dateInput = (iso: string) => iso.slice(0, 10);

export default function PromotionsPage() {
  const banners = useBanners();
  const promos = usePromoCodes();
  const referral = useReferralConfig();
  const cityName = useCityName();
  const canManage = useCan("promos.manage");
  const [banner, setBanner] = useState<Banner | "new" | null>(null);
  const [promo, setPromo] = useState<PromoCode | "new" | null>(null);
  const toggleBanner = useAction(({ id, ...b }: Banner) => api.saveBanner(b, id), ["banners"]);
  const togglePromo = useAction(({ id, uses: _uses, ...p }: PromoCode) => api.savePromoCode(p, id), ["promos"]);

  if (!banners.data || !promos.data || !referral.data) return <Spinner />;
  const now = new Date().toISOString();

  return (
    <>
      {!canManage ? <Locked permission="promos.manage" what="change promotions" /> : null}

      <section className="card card--flush">
        <div className="card__head" style={{ padding: "18px 20px 0" }}>
          <div>
            <h2>Home banners</h2>
            <p className="small muted">The sliding banners at the top of the customer app.</p>
          </div>
          {canManage ? <Button size="sm" onClick={() => setBanner("new")}><Plus /> Add banner</Button> : null}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Banner</th>
                <th>Cities</th>
                <th>Runs</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {banners.data.map((b) => (
                <tr key={b.id}>
                  <td className="strong">{b.title}</td>
                  <td data-label="Cities">{b.cityIds.map(cityName).join(", ")}</td>
                  <td className="muted" data-label="Runs">{dayLabel(new Date(b.startsAt))} – {dayLabel(new Date(b.endsAt))}</td>
                  <td>{!b.active ? <Badge>Off</Badge> : b.endsAt < now ? <Badge tone="warning">Ended</Badge> : b.startsAt > now ? <Badge tone="primary">Scheduled</Badge> : <Badge tone="success">Showing</Badge>}</td>
                  <td>
                    {canManage ? (
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <Button size="sm" variant="ghost" onClick={() => setBanner(b)}>Edit</Button>
                        <Switch checked={b.active} disabled={toggleBanner.isPending} label={`${b.title} is on`} onChange={(active) => toggleBanner.mutate({ ...b, active })} />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card--flush">
        <div className="card__head" style={{ padding: "18px 20px 0" }}>
          <div>
            <h2>Promo codes</h2>
            <p className="small muted">Codes customers type in at checkout.</p>
          </div>
          {canManage ? <Button size="sm" onClick={() => setPromo("new")}><Plus /> Add code</Button> : null}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Used</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {promos.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <code className="strong">{p.code}</code>
                    <div className="small muted">{p.description}</div>
                  </td>
                  <td data-label="Discount">{promoValue(p)}</td>
                  <td data-label="Used" style={{ minWidth: 140 }}>
                    <div className="small">{p.uses} of {p.maxUses}</div>
                    <div className="meter"><span style={{ width: `${Math.min(100, (p.uses / p.maxUses) * 100)}%` }} /></div>
                  </td>
                  <td>{!p.active ? <Badge>Off</Badge> : p.uses >= p.maxUses ? <Badge tone="warning">Used up</Badge> : <Badge tone="success">Active</Badge>}</td>
                  <td>
                    {canManage ? (
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <Button size="sm" variant="ghost" onClick={() => setPromo(p)}>Edit</Button>
                        <Switch checked={p.active} disabled={togglePromo.isPending} label={`${p.code} is active`} onChange={(active) => togglePromo.mutate({ ...p, active })} />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ReferralCard key={JSON.stringify(referral.data)} config={referral.data} canManage={canManage} />

      {banner ? <BannerForm banner={banner === "new" ? undefined : banner} onClose={() => setBanner(null)} /> : null}
      {promo ? <PromoForm promo={promo === "new" ? undefined : promo} onClose={() => setPromo(null)} /> : null}
    </>
  );
}

function ReferralCard({ config, canManage }: { config: ReferralConfig; canManage: boolean }) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [give, setGive] = useState(String(config.refereeDiscountKobo / 100));
  const [get, setGet] = useState(String(config.referrerRewardKobo / 100));
  const save = useAction(() => api.updateReferralConfig({ enabled, refereeDiscountKobo: nairaToKobo(Number(give) || 0), referrerRewardKobo: nairaToKobo(Number(get) || 0) }), ["referral"]);
  const dirty = enabled !== config.enabled || nairaToKobo(Number(give) || 0) !== config.refereeDiscountKobo || nairaToKobo(Number(get) || 0) !== config.referrerRewardKobo;
  const num = (set: (v: string) => void) => (e: { target: { value: string } }) => set(e.target.value.replace(/\D/g, ""));
  return (
    <section className="card stack">
      <div className="between">
        <div>
          <h2>Referral programme</h2>
          <p className="small muted">A customer shares their code; both sides are rewarded after the friend’s first order.</p>
        </div>
        <Switch checked={enabled} disabled={!canManage} label="Referral programme is on" onChange={setEnabled} />
      </div>
      <div className="form-grid">
        <Input label="New customer gets (off first order)" prefix="₦" inputMode="numeric" disabled={!canManage} value={give} onChange={num(setGive)} />
        <Input label="Referrer gets (wallet credit)" prefix="₦" inputMode="numeric" disabled={!canManage} value={get} onChange={num(setGet)} />
      </div>
      {save.isError ? <p className="text-danger">{save.error.message}</p> : null}
      {canManage ? <div><Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(undefined)}>Save referral settings</Button></div> : null}
    </section>
  );
}

function BannerForm({ banner, onClose }: { banner?: Banner; onClose: () => void }) {
  const cities = useCities();
  const [title, setTitle] = useState(banner?.title ?? "");
  const [cityIds, setCityIds] = useState<string[]>(banner?.cityIds ?? []);
  const [startsAt, setStartsAt] = useState(dateInput(banner?.startsAt ?? new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(dateInput(banner?.endsAt ?? new Date(Date.now() + 7 * 86_400_000).toISOString()));
  const [touched, setTouched] = useState(false);
  const save = useAction(() => api.saveBanner({ title, cityIds, active: banner?.active ?? true, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(`${endsAt}T23:59:59`).toISOString() }, banner?.id), ["banners"]);
  const errors = { title: title.trim().length < 3 ? "Enter the banner text" : null, cities: cityIds.length === 0 ? "Choose at least one city" : null, dates: !startsAt || !endsAt || endsAt < startsAt ? "The end date must be after the start" : null };
  const valid = Object.values(errors).every((e) => !e);
  return (
    <Modal
      title={banner ? "Edit banner" : "Add a banner"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => (setTouched(true), valid && save.mutate(undefined, { onSuccess: onClose }))}>{banner ? "Save changes" : "Add banner"}</Button>
        </>
      }>
      <div className="stack">
        <Input label="Banner text" placeholder="e.g. Free delivery this weekend" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} error={touched ? errors.title : null} />
        <div className="field">
          <span className="label">Show in</span>
          <div className="wrap">
            {cities.data?.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={cityIds.includes(c.id)} onClick={() => setCityIds((ids) => (ids.includes(c.id) ? ids.filter((i) => i !== c.id) : [...ids, c.id]))}>
                {c.name}
              </button>
            ))}
          </div>
          {touched && errors.cities ? <span className="field__error">{errors.cities}</span> : null}
        </div>
        <div className="form-grid">
          <Input label="Starts" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <Input label="Ends" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} error={touched ? errors.dates : null} />
        </div>
        {save.isError ? <p className="text-danger">{save.error.message}</p> : null}
      </div>
    </Modal>
  );
}

function PromoForm({ promo, onClose }: { promo?: PromoCode; onClose: () => void }) {
  const [code, setCode] = useState(promo?.code ?? "");
  const [description, setDescription] = useState(promo?.description ?? "");
  const [kind, setKind] = useState<PromoCode["kind"]>(promo?.kind ?? "percent");
  const [value, setValue] = useState(promo ? String(promo.kind === "amount" ? promo.value / 100 : promo.value) : "");
  const [maxUses, setMaxUses] = useState(String(promo?.maxUses ?? 500));
  const [touched, setTouched] = useState(false);
  const numeric = kind === "free_delivery" ? 0 : kind === "amount" ? nairaToKobo(Number(value) || 0) : Number(value) || 0;
  const save = useAction(() => api.savePromoCode({ code, description: description.trim() || promoValue({ kind, value: numeric }), kind, value: numeric, active: promo?.active ?? true, maxUses: Number(maxUses) }, promo?.id), ["promos"]);
  const errors = {
    code: !/^[A-Za-z0-9]{4,16}$/.test(code.trim()) ? "4–16 letters and numbers, no spaces" : null,
    value: kind === "free_delivery" ? null : kind === "percent" ? (!(numeric >= 1 && numeric <= 100) ? "Between 1 and 100" : null) : numeric <= 0 ? "Enter an amount" : null,
    maxUses: !(Number(maxUses) >= 1) ? "At least 1" : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  return (
    <Modal
      title={promo ? `Edit ${promo.code}` : "Add a promo code"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => (setTouched(true), valid && save.mutate(undefined, { onSuccess: onClose }))}>{promo ? "Save changes" : "Add code"}</Button>
        </>
      }>
      <div className="stack">
        <Input label="Code" placeholder="e.g. VENDO10" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))} error={touched ? errors.code : null} />
        <div className="field">
          <span className="label">Discount type</span>
          <div className="wrap" role="radiogroup" aria-label="Discount type">
            {([["percent", "Percent off"], ["amount", "Naira off"], ["free_delivery", "Free delivery"]] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" className="chip" aria-checked={kind === k} onClick={() => (setKind(k), setValue(""))}>{label}</button>
            ))}
          </div>
        </div>
        <div className="form-grid">
          {kind !== "free_delivery" ? <Input label={kind === "percent" ? "Percent off" : "Amount off"} prefix={kind === "amount" ? "₦" : "%"} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} error={touched ? errors.value : null} /> : null}
          <Input label="Most times it can be used" inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))} error={touched ? errors.maxUses : null} />
        </div>
        <Input label="Description (optional)" placeholder="Shown to the customer" value={description} onChange={(e) => setDescription(e.target.value)} />
        {save.isError ? <p className="text-danger">{save.error.message}</p> : null}
      </div>
    </Modal>
  );
}
