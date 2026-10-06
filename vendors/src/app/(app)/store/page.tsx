"use client";

import { useState } from "react";

import { useCities, useMe, useStore, useUpdateStore } from "@/api/queries";
import { PickupPoint } from "@/components/PickupPoint";
import type { Store } from "@/api/types";
import { defaultHours } from "@/lib/hours";
import { HoursEditor } from "@/components/HoursEditor";
import { ImagePicker } from "@/components/ImagePicker";
import { Badge, Button, Input, Spinner, Textarea } from "@/components/ui";
import { storeCategories, SUPPORT_WHATSAPP } from "@/lib/categories";

export default function StorePage() {
  const store = useStore();
  if (store.isError) return <p className="note note--danger">{store.error?.message}</p>;
  if (!store.data) return <Spinner />;
  return <Settings store={store.data} />;
}

function Settings({ store }: { store: Store }) {
  const me = useMe();
  const cities = useCities();
  const details = useUpdateStore();
  const hoursSave = useUpdateStore();
  const branding = useUpdateStore();
  const [name, setName] = useState(store.name);
  const [cuisine, setCuisine] = useState(store.cuisine);
  const [description, setDescription] = useState(store.description);
  const [address, setAddress] = useState(store.address);
  const [latitude, setLatitude] = useState(String(store.location.lat));
  const [longitude, setLongitude] = useState(String(store.location.lng));
  const [hours, setHours] = useState(store.hours.length ? store.hours : defaultHours());
  const [touched, setTouched] = useState(false);
  const errors = { name: name.trim().length < 2 ? "Enter your store name" : null, cuisine: cuisine.trim().length < 2 ? "Describe what you sell" : null, address: address.trim().length < 5 ? "Enter your store address" : null };
  const category = storeCategories.find((c) => c.value === store.category);
  const hoursValid = hours.some((d) => d.open);

  return (
    <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="stack">
        <section className="card stack">
          <div className="card__head" style={{ marginBottom: 0 }}>
            <h2>Logo &amp; banner</h2>
            {branding.isPending ? <Badge>Saving…</Badge> : branding.isSuccess ? <Badge tone="success">Saved</Badge> : null}
          </div>
          <p className="small muted">These appear on your store page in the Vendo app. Stores with real photos get more orders.</p>

          {/* how customers see it */}
          <div className="store-preview" aria-label="Preview of your store page">
            <div className="store-preview__banner">{store.bannerUrl ? <img src={store.bannerUrl} alt="" /> : <span aria-hidden>{category?.emoji ?? "🏪"}</span>}</div>
            <div className="store-preview__body" style={{ position: "relative" }}>
              <div className="store-preview__logo">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : <span aria-hidden>{category?.emoji ?? "🏪"}</span>}</div>
              <div className="strong">{store.name}</div>
              <div className="small muted">{store.cuisine}</div>
            </div>
          </div>

          <ImagePicker kind="logo" label="Logo" hint="A square picture works best. JPEG, PNG or WebP." value={store.logoUrl} onChange={(logoUrl) => branding.mutate({ logoUrl })} placeholder={<span aria-hidden>{category?.emoji ?? "🏪"}</span>} />
          <ImagePicker kind="banner" label="Banner" hint="A wide photo of your food or shop front, about 3 times as wide as it is tall." value={store.bannerUrl} onChange={(bannerUrl) => branding.mutate({ bannerUrl })} />
          {branding.isError ? <p className="text-danger">{branding.error.message}</p> : null}
        </section>

        <section className="card stack">
          <div className="card__head" style={{ marginBottom: 0 }}>
            <h2>Store details</h2>
            {details.isSuccess ? <Badge tone="success">Saved</Badge> : null}
          </div>
          <Input label="Store name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} error={touched ? errors.name : null} />
          <Input label="In a few words" maxLength={40} value={cuisine} onChange={(e) => setCuisine(e.target.value)} error={touched ? errors.cuisine : null} />
          <Textarea label="About your store" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Textarea label="Store address" maxLength={140} value={address} onChange={(e) => setAddress(e.target.value)} error={touched ? errors.address : null} />
          <PickupPoint cityId={store.cityId} latitude={latitude} longitude={longitude} onChange={(lat, lng) => (setLatitude(lat), setLongitude(lng))} />
          {details.isError ? <p className="text-danger">{details.error.message}</p> : null}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button
              loading={details.isPending}
              onClick={() => {
                setTouched(true);
                if (!Object.values(errors).some(Boolean)) details.mutate({ name: name.trim(), cuisine: cuisine.trim(), description: description.trim(), address: address.trim(), location: { lat: Number(latitude), lng: Number(longitude) } });
              }}>
              Save details
            </Button>
          </div>
        </section>

        <section className="card stack-sm">
          <h2 style={{ fontSize: 16 }}>Your plan</h2>
          <div className="wrap">
            <Badge tone="primary">{store.tier} plan</Badge>
            <Badge>{store.commissionRate === null ? "Commission not configured" : `${Math.round(store.commissionRate * 100)}% commission`}</Badge>
            <Badge>
              {category?.emoji} {category?.label}
            </Badge>
            <Badge>{cities.data?.find((c) => c.id === store.cityId)?.name}</Badge>
          </div>
          <p className="small muted">
            To change your category, city or plan, <a className="text-primary" href={SUPPORT_WHATSAPP} target="_blank" rel="noopener">message Vendo support</a>.
          </p>
          <p className="small subtle">
            Signed in as {me.data?.name} · {me.data?.phone}
          </p>
        </section>
      </div>

      <section className="card stack">
        <div className="card__head" style={{ marginBottom: 0 }}>
          <h2>Opening hours</h2>
          {hoursSave.isSuccess ? <Badge tone="success">Saved</Badge> : null}
        </div>
        <p className="small muted">Customers see these hours on your store page. You still open and close for orders yourself with the switch at the top.</p>
        <HoursEditor value={hours} onChange={setHours} />
        {!hoursValid ? <p className="text-danger">Open on at least one day.</p> : null}
        {hoursSave.isError ? <p className="text-danger">{hoursSave.error.message}</p> : null}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button disabled={!hoursValid} loading={hoursSave.isPending} onClick={() => hoursSave.mutate({ hours })}>
            Save hours
          </Button>
        </div>
      </section>
    </div>
  );
}
