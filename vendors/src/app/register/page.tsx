"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Clock, LogOut } from "lucide-react";
import { useState } from "react";

import { api } from "@/api/client";
import { defaultHours } from "@/lib/hours";
import { useCities, useRegisterStore, useStore } from "@/api/queries";
import type { DayHours, Store, StoreCategory } from "@/api/types";
import { useGate, useStoreSync } from "@/components/AppShell";
import { HoursEditor } from "@/components/HoursEditor";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Input, Spinner, Textarea } from "@/components/ui";
import { storeCategories, SUPPORT_WHATSAPP } from "@/lib/categories";
import { summariseHours } from "@/lib/orders";
import { useSession } from "@/store/session";

/** Store registration: your store → location and hours → under review. Shown until the store is approved. */
export default function RegisterPage() {
  const ok = useGate("registering");
  useStoreSync(ok);
  const queryClient = useQueryClient();
  const signOut = useSession((s) => s.signOut);
  const store = useStore(ok);
  const cities = useCities();
  const register = useRegisterStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<StoreCategory>("restaurant");
  const [cuisine, setCuisine] = useState("");
  const [description, setDescription] = useState("");
  const [cityId, setCityId] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const locationValid = latitude.trim() !== "" && longitude.trim() !== "" && Number.isFinite(Number(latitude)) && Math.abs(Number(latitude)) <= 90 && Number.isFinite(Number(longitude)) && Math.abs(Number(longitude)) <= 180;
  const [hours, setHours] = useState<DayHours[]>(defaultHours);
  const [reapplying, setReapplying] = useState(false);
  const [touched, setTouched] = useState(false);

  if (store.isError) return <p className="note note--danger">{store.error.message}</p>;
  if (!ok || store.isPending) return <Spinner />;
  const reviewing = store.data && !reapplying;
  const shown = reviewing ? 3 : step;

  const next = () => {
    setTouched(true);
    if (name.trim().length >= 2 && cuisine.trim().length >= 2) {
      setTouched(false);
      setStep(2);
    }
  };
  const submit = () => {
    setTouched(true);
    if (cityId && address.trim().length >= 5 && locationValid && hours.some((d) => d.open)) register.mutate({ name, category, cuisine: cuisine.trim(), description: description.trim(), cityId, address, hours, location: { lat: Number(latitude), lng: Number(longitude) } }, {onSuccess:()=>setReapplying(false)});
  };

  return (
    <div className="wizard">
      <div className="between">
        <div className="row">
          <Logo />
          <span className="brand__tag">VENDOR</span>
        </div>
        <div className="row">
          <ThemeToggle />
          <button
            type="button"
            className="icon-btn"
            aria-label="Log out"
            title="Log out"
            onClick={() => {
              queryClient.clear();
              void api.logout().catch(() => {});
              signOut();
            }}>
            <LogOut />
          </button>
        </div>
      </div>
      <div className="stack-sm">
        <span className="eyebrow">Store registration · Step {shown} of 3</span>
        <div className="steps">
          {[1, 2, 3].map((n) => (
            <span key={n} data-on={n <= shown} />
          ))}
        </div>
      </div>

      {reviewing && store.data ? (
        <><Review store={store.data} city={cities.data?.find((c) => c.id === store.data!.cityId)?.name} />{store.data.approval === "rejected" ? <Button onClick={()=>setReapplying(true)}>Submit a new application</Button> : null}</>
      ) : step === 1 ? (
        <div className="card stack">
          <div>
            <h1>Your store</h1>
            <p className="muted">This is what customers see in the Vendo app.</p>
          </div>
          <Input label="Store name" placeholder="e.g. Arewa Kitchen" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} error={touched && name.trim().length < 2 ? "Enter your store name" : null} />
          <div className="field">
            <span className="label">What do you sell?</span>
            <div className="wrap" role="radiogroup" aria-label="Store category">
              {storeCategories.map((c) => (
                <button key={c.value} type="button" role="radio" className="chip" aria-checked={category === c.value} onClick={() => setCategory(c.value)}>
                  <span aria-hidden>{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
          </div>
          <Input label="In a few words" placeholder="e.g. Northern Nigerian, Grill & suya" maxLength={40} value={cuisine} onChange={(e) => setCuisine(e.target.value)} error={touched && cuisine.trim().length < 2 ? "Describe what you sell in a few words" : null} />
          <Textarea label="About your store (optional)" placeholder="What makes your food special?" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button onClick={next}>Continue</Button>
          </div>
        </div>
      ) : (
        <div className="card stack">
          <div>
            <h1>Location &amp; hours</h1>
            <p className="muted">Riders collect orders from this address during these hours.</p>
          </div>
          <div className="field">
            <span className="label">City</span>
            <div className="wrap" role="radiogroup" aria-label="City">
              {cities.data?.map((c) => (
                <button key={c.id} type="button" role="radio" className="chip" aria-checked={cityId === c.id} onClick={() => setCityId(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
            {touched && !cityId ? <span className="field__error">Choose your city</span> : null}
          </div>
          <Textarea label="Store address" placeholder="Street, area and a nearby landmark" maxLength={140} value={address} onChange={(e) => setAddress(e.target.value)} error={touched && address.trim().length < 5 ? "Enter your store address" : null} />
          <div className="grid-2"><Input label="Store latitude" value={latitude} onChange={e=>setLatitude(e.target.value)} inputMode="decimal" /><Input label="Store longitude" value={longitude} onChange={e=>setLongitude(e.target.value)} inputMode="decimal" /></div>
          <Button variant="secondary" onClick={()=>navigator.geolocation.getCurrentPosition(p=>{setLatitude(String(p.coords.latitude));setLongitude(String(p.coords.longitude));},()=>alert('Location unavailable. Enter the coordinates of your store.'))}>Use my current location</Button>
          <p className="small muted">Use your store’s exact pickup location, inside the selected service city.</p>
          {touched && !locationValid ? <p className="text-danger">Enter valid store coordinates.</p> : null}
          {cities.isError ? <p className="text-danger">{cities.error.message}</p> : null}
          <div className="field">
            <span className="label">Opening hours</span>
            <HoursEditor value={hours} onChange={setHours} />
            {touched && !hours.some((d) => d.open) ? <span className="field__error">Open on at least one day</span> : null}
          </div>
          {register.isError ? <p className="text-danger">{register.error.message}</p> : null}
          <div className="between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button loading={register.isPending} onClick={submit}>
              Submit for review
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Review({ store, city }: { store: Store; city?: string }) {
  if (store.approval === "suspended" || store.approval === "rejected") {
    return (
      <div className="card stack">
        <h1>{store.approval === "suspended" ? "Store suspended" : "We couldn’t approve your store"}</h1>
        <p className="muted">{store.approvalNote ?? "Message the Vendo partnerships team to find out why and what to do next."}</p>
        <a className="btn btn--primary" href={SUPPORT_WHATSAPP} target="_blank" rel="noopener">
          Message Vendo on WhatsApp
        </a>
      </div>
    );
  }
  return (
    <div className="card stack" style={{ textAlign: "center", justifyItems: "center" }}>
      <div className="empty__icon" style={{ width: 72, height: 72, borderRadius: 36 }}>
        <Clock size={30} />
      </div>
      <h1>We’re reviewing {store.name}</h1>
      <p className="muted" style={{ maxWidth: 460 }}>
        The Vendo partnerships team will confirm your details and may call you. This page updates by itself once you’re approved.
      </p>
      <div className="stack-sm" style={{ textAlign: "left", width: "min(100%, 420px)" }}>
        {(
          [
            ["Store details sent", true],
            ["Under review", true],
            ["Approved — add your menu and open", false],
          ] as const
        ).map(([label, done]) => (
          <div key={label} className="row">
            <CircleCheck size={20} color={done ? "var(--success)" : "var(--line-strong)"} />
            <span className={done ? "strong" : "subtle"}>{label}</span>
          </div>
        ))}
        <div className="note" style={{ marginTop: 8 }}>
          {store.name} · {city ?? "—"} · {summariseHours(store.hours)}
        </div>
      </div>
      <a className="btn btn--secondary" href={SUPPORT_WHATSAPP} target="_blank" rel="noopener">
        Questions? Message Vendo
      </a>
    </div>
  );
}
