"use client";

import { Users } from "lucide-react";
import { useState } from "react";

import { useCustomers } from "@/api/queries";
import type { Customer } from "@/api/types";
import { CitySelect, ExportButton, KV, Locked, SearchBox, WalletAdjust, useCan, useCityName } from "@/components/admin";
import { Button, Empty, Modal, Spinner } from "@/components/ui";
import { dayLabel } from "@/lib/dates";
import { formatNaira } from "@/lib/money";

export default function CustomersPage() {
  const { data } = useCustomers();
  const cityName = useCityName();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  if (!data) return <Spinner />;
  const q = query.trim().toLowerCase();
  const rows = data.filter((c) => (!city || c.cityId === city) && (!q || [c.name, c.phone].some((v) => v.toLowerCase().includes(q)))).sort((a, b) => b.spentKobo - a.spentKobo);
  const open = data.find((c) => c.id === openId);

  return (
    <>
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search name or phone" />
        <CitySelect value={city} onChange={setCity} />
        <span className="grow" />
        <ExportButton rows={rows} filename="vendo-customers.csv" columns={[["Name", (c) => c.name], ["Phone", (c) => c.phone], ["City", (c) => cityName(c.cityId)], ["Orders", (c) => c.orders], ["Spent (NGN)", (c) => c.spentKobo / 100], ["Wallet (NGN)", (c) => c.walletKobo / 100], ["Joined", (c) => c.joinedAt]]} />
      </div>
      <section className="card card--flush">
        {rows.length === 0 ? (
          <Empty icon={<Users />} title="No customers match">Try a different city or search.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>City</th>
                  <th>Joined</th>
                  <th className="num">Orders</th>
                  <th className="num">Spent</th>
                  <th className="num">Wallet</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setOpenId(c.id)}>
                    <td>
                      <button type="button" className="strong" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>{c.name}</button>
                      <div className="small muted">{c.phone}</div>
                    </td>
                    <td data-label="City">{cityName(c.cityId)}</td>
                    <td className="muted" data-label="Joined">{dayLabel(new Date(c.joinedAt))}</td>
                    <td className="num" data-label="Orders">{c.orders}</td>
                    <td className="num" data-label="Spent">{formatNaira(c.spentKobo)}</td>
                    <td className="num strong" data-label="Wallet">{formatNaira(c.walletKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open ? <CustomerDrawer customer={open} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function CustomerDrawer({ customer: c, onClose }: { customer: Customer; onClose: () => void }) {
  const cityName = useCityName();
  const canAdjust = useCan("wallet.adjust");
  const [adjusting, setAdjusting] = useState(false);
  return (
    <Modal title={c.name} side onClose={onClose}>
      <div className="stack">
        <section className="stats" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          <div className="card stat"><span className="stat__label">Wallet balance</span><span className="stat__value stat__value--accent">{formatNaira(c.walletKobo)}</span></div>
          <div className="card stat"><span className="stat__label">Orders</span><span className="stat__value">{c.orders}</span></div>
        </section>
        <KV rows={[["Phone", <a key="p" href={`tel:${c.phone}`} className="text-primary">{c.phone}</a>], ["City", cityName(c.cityId)], ["Joined", dayLabel(new Date(c.joinedAt))], ["Total spent", formatNaira(c.spentKobo)]]} />
        <div className="stack-sm">
          <h3 className="label">Actions</h3>
          {canAdjust ? <div><Button variant="secondary" size="sm" onClick={() => setAdjusting(true)}>Adjust wallet</Button></div> : <Locked permission="wallet.adjust" what="adjust wallets" />}
        </div>
      </div>
      {adjusting ? <WalletAdjust party="customer" id={c.id} name={c.name} balanceKobo={c.walletKobo} refresh={["customers"]} onClose={() => setAdjusting(false)} /> : null}
    </Modal>
  );
}
