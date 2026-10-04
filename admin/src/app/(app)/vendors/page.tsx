"use client";

import { Plus, Store } from "lucide-react";
import { useState } from "react";

import { api } from "@/api/client";
import { useAction, useCities, useVendors } from "@/api/queries";
import type { Tier, Vendor, VendorCategory, VendorInput } from "@/api/types";
import { ActionModal, ApprovalBadge, CitySelect, ExportButton, KV, Locked, SearchBox, Tabs, useCan, useCityName } from "@/components/admin";
import { Badge, Button, Empty, Input, Modal, Spinner } from "@/components/ui";
import { formatNaira } from "@/lib/money";

const categoryLabel: Record<VendorCategory, string> = { restaurant: "Restaurant", fast_food: "Fast food", drinks: "Drinks", groceries: "Groceries", pharmacy: "Pharmacy" };
const tierLabel: Record<Tier, string> = { basic: "Basic", standard: "Standard", premium: "Premium" };
const pct = (rate: number) => `${Math.round(rate * 100)}%`;

export default function VendorsPage() {
  const { data } = useVendors();
  const cityName = useCityName();
  const canManage = useCan("vendors.manage");
  const [tab, setTab] = useState<"all" | "under_review" | "suspended">("all");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!data) return <Spinner />;
  const q = query.trim().toLowerCase();
  const rows = data.filter((v) => (tab === "all" || v.approval === tab) && (!city || v.cityId === city) && (!q || [v.name, v.ownerName, v.phone].some((x) => x.toLowerCase().includes(q))));
  const open = data.find((v) => v.id === openId);

  return (
    <>
      <Tabs
        label="Vendors"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: "All vendors" },
          { value: "under_review", label: "Applications", count: data.filter((v) => v.approval === "under_review").length, alert: true },
          { value: "suspended", label: "Suspended" },
        ]}
      />
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search vendor, owner or phone" />
        <CitySelect value={city} onChange={setCity} />
        <span className="grow" />
        <ExportButton rows={rows} filename="vendo-vendors.csv" columns={[["Vendor", (v) => v.name], ["Category", (v) => categoryLabel[v.category]], ["City", (v) => cityName(v.cityId)], ["Status", (v) => v.approval], ["Tier", (v) => tierLabel[v.tier]], ["Commission", (v) => pct(v.commissionRate)], ["Orders (30d)", (v) => v.orders30d], ["Sales (30d, NGN)", (v) => v.revenue30dKobo / 100]]} />
        {canManage ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add vendor
          </Button>
        ) : null}
      </div>

      <section className="card card--flush">
        {rows.length === 0 ? (
          <Empty icon={<Store />} title="No vendors match">Try a different filter or search.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th>City</th>
                  <th>Tier</th>
                  <th className="num">Commission</th>
                  <th className="num">Orders (30d)</th>
                  <th className="num">Sales (30d)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="clickable" data-new={v.approval === "under_review"} onClick={() => setOpenId(v.id)}>
                    <td>
                      <button type="button" className="strong" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>{v.name}</button>
                      <div className="small muted">{categoryLabel[v.category]}{v.rating ? ` · ${v.rating.toFixed(1)} ★` : ""}</div>
                    </td>
                    <td>{v.approval === "approved" ? <Badge tone={v.isOpen ? "success" : undefined}>{v.isOpen ? "Open" : "Closed"}</Badge> : <ApprovalBadge status={v.approval} />}</td>
                    <td data-label="City">{cityName(v.cityId)}</td>
                    <td data-label="Tier">{tierLabel[v.tier]}</td>
                    <td className="num" data-label="Commission">{pct(v.commissionRate)}</td>
                    <td className="num" data-label="Orders (30d)">{v.orders30d}</td>
                    <td className="num strong" data-label="Sales (30d)">{formatNaira(v.revenue30dKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {open ? <VendorDrawer vendor={open} onClose={() => setOpenId(null)} /> : null}
      {adding ? <VendorForm onClose={() => setAdding(false)} /> : null}
    </>
  );
}

function VendorDrawer({ vendor: v, onClose }: { vendor: Vendor; onClose: () => void }) {
  const cityName = useCityName();
  const canManage = useCan("vendors.manage");
  const [action, setAction] = useState<"edit" | "suspend" | null>(null);
  const act = useAction((kind: "approve" | "reject" | "reinstate") => (kind === "reinstate" ? api.setVendorSuspended(v.id, false, "") : api.reviewVendor(v.id, kind)), ["vendors"]);
  return (
    <Modal title={v.name} side onClose={onClose}>
      <div className="stack">
        <div className="row wrap">
          <ApprovalBadge status={v.approval} />
          {v.approval === "approved" ? <Badge tone={v.isOpen ? "success" : undefined}>{v.isOpen ? "Open now" : "Closed now"}</Badge> : null}
          <Badge>{tierLabel[v.tier]} tier</Badge>
        </div>
        <section className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="card stat"><span className="stat__label">Orders (30d)</span><span className="stat__value">{v.orders30d}</span></div>
          <div className="card stat"><span className="stat__label">Rating</span><span className="stat__value">{v.rating ? v.rating.toFixed(1) : "New"}</span></div>
          <div className="card stat"><span className="stat__label">Menu items</span><span className="stat__value">{v.menuItems}</span></div>
        </section>
        <KV rows={[["Category", categoryLabel[v.category]], ["City", cityName(v.cityId)], ["Address", v.address], ["Owner", v.ownerName], ["Phone", <a key="p" href={`tel:${v.phone}`} className="text-primary">{v.phone}</a>], ["Commission", pct(v.commissionRate)], ["Sales (30d)", formatNaira(v.revenue30dKobo)], ["Vendo earned", formatNaira(Math.round(v.revenue30dKobo * v.commissionRate))]]} />
        <div className="stack-sm">
          <h3 className="label">Actions</h3>
          {canManage ? (
            <div className="wrap">
              {v.approval === "under_review" ? (
                <>
                  <Button size="sm" loading={act.isPending && act.variables === "approve"} onClick={() => act.mutate("approve")}>Approve store</Button>
                  <Button size="sm" variant="danger" loading={act.isPending && act.variables === "reject"} onClick={() => act.mutate("reject", { onSuccess: onClose })}>Reject</Button>
                </>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => setAction("edit")}>Edit details</Button>
              {v.approval === "approved" ? <Button size="sm" variant="danger" onClick={() => setAction("suspend")}>Suspend</Button> : null}
              {v.approval === "suspended" ? <Button size="sm" loading={act.isPending} onClick={() => act.mutate("reinstate")}>Lift suspension</Button> : null}
            </div>
          ) : (
            <Locked permission="vendors.manage" what="approve, edit or suspend vendors" />
          )}
          {act.isError ? <p className="text-danger">{act.error.message}</p> : null}
        </div>
      </div>
      {action === "edit" ? <VendorForm vendor={v} onClose={() => setAction(null)} /> : null}
      {action === "suspend" ? <ActionModal title={`Suspend ${v.name}?`} intro="The store closes and disappears from the customer app until the suspension is lifted. Orders already placed carry on." confirmLabel="Suspend" danger refresh={["vendors"]} run={({ reason }) => api.setVendorSuspended(v.id, true, reason)} onClose={() => setAction(null)} /> : null}
    </Modal>
  );
}

function VendorForm({ vendor, onClose }: { vendor?: Vendor; onClose: () => void }) {
  const cities = useCities();
  const [form, setForm] = useState<VendorInput>(vendor ? { name: vendor.name, category: vendor.category, cityId: vendor.cityId, address: vendor.address, ownerName: vendor.ownerName, phone: vendor.phone, commissionRate: vendor.commissionRate, tier: vendor.tier } : { name: "", category: "restaurant", cityId: "kaduna", address: "", ownerName: "", phone: "", commissionRate: 0.15, tier: "basic" });
  const [percent, setPercent] = useState(String(Math.round(form.commissionRate * 100)));
  const [touched, setTouched] = useState(false);
  const save = useAction(() => api.saveVendor({ ...form, commissionRate: Number(percent) / 100 }, vendor?.id), ["vendors"]);
  const set = <K extends keyof VendorInput>(key: K, value: VendorInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const errors = {
    name: form.name.trim().length < 2 ? "Enter the vendor’s name" : null,
    address: form.address.trim().length < 5 ? "Enter the address" : null,
    ownerName: form.ownerName.trim().length < 2 ? "Enter the owner’s name" : null,
    phone: form.phone.replace(/\D/g, "").length < 10 ? "Enter a phone number" : null,
    percent: percent === "" || Number(percent) < 0 || Number(percent) > 50 ? "Between 0 and 50" : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (key: keyof typeof errors) => (touched ? errors[key] : null);

  return (
    <Modal
      title={vendor ? `Edit ${vendor.name}` : "Add a vendor"}
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => (setTouched(true), valid && save.mutate(undefined, { onSuccess: onClose }))}>{vendor ? "Save changes" : "Add vendor"}</Button>
        </>
      }>
      <div className="form-grid">
        <Input label="Vendor name" value={form.name} onChange={(e) => set("name", e.target.value)} error={show("name")} />
        <div className="field">
          <label htmlFor="v-cat">Category</label>
          <select id="v-cat" className="select" value={form.category} onChange={(e) => set("category", e.target.value as VendorCategory)}>
            {Object.entries(categoryLabel).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="v-city">City</label>
          <select id="v-city" className="select" value={form.cityId} onChange={(e) => set("cityId", e.target.value)}>
            {cities.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Input label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} error={show("address")} />
        <Input label="Owner’s name" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} error={show("ownerName")} />
        <Input label="Phone" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={show("phone")} />
        <Input label="Commission (%)" inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, "").slice(0, 2))} error={show("percent")} hint="Vendo’s share of each food order" />
        <div className="field">
          <label htmlFor="v-tier">Subscription tier</label>
          <select id="v-tier" className="select" value={form.tier} onChange={(e) => set("tier", e.target.value as Tier)}>
            {Object.entries(tierLabel).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      </div>
      {save.isError ? <p className="text-danger" style={{ marginTop: 12 }}>{save.error.message}</p> : null}
    </Modal>
  );
}
