"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bike, Coins, Send, Store } from "lucide-react";
import { site, whatsappLink } from "@/lib/site";

const tracks = [
  { id: "rider", label: "Rider", icon: Bike },
  { id: "vendor", label: "Vendor", icon: Store },
  { id: "invest", label: "Bike owner", icon: Coins },
] as const;
type Track = (typeof tracks)[number]["id"];

// Applications are sent to the ops team on WhatsApp until the Rider app / vendor onboarding is live.
export function JoinForm() {
  const [track, setTrack] = useState<Track>("rider");

  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "");
    if (fromHash === "vendors") setTrack("vendor");
    if (fromHash === "invest") setTrack("invest");
  }, []);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) || "").trim();
    const heading = { rider: "I'd like to ride with Vendo.", vendor: "I'd like to sell on Vendo.", invest: "I'm interested in owning a Vendo bike." }[track];
    const lines = [
      `Hi Vendo, ${heading}`,
      `Name: ${get("name")}`,
      `Phone: ${get("phone")}`,
      `City: ${get("city")}`,
      track === "rider" && `Has own bike: ${get("bike")}`,
      track === "vendor" && `Business: ${get("business")}`,
      track === "invest" && `Preferred bike: ${get("option")}`,
      get("note") && `Note: ${get("note")}`,
    ].filter(Boolean);
    window.open(whatsappLink(lines.join("\n")), "_blank", "noopener");
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="segmented" role="radiogroup" aria-label="I want to join as">
        {tracks.map((t) => (
          <label key={t.id}>
            <input type="radio" name="track" checked={track === t.id} onChange={() => setTrack(t.id)} />
            <span><t.icon /> {t.label}</span>
          </label>
        ))}
      </div>
      <div className="form__row">
        <div className="field">
          <label htmlFor="j-name">Full name</label>
          <input id="j-name" name="name" required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="j-phone">Phone number</label>
          <input id="j-phone" name="phone" type="tel" required autoComplete="tel" placeholder="080..." />
        </div>
      </div>
      <div className="form__row">
        <div className="field">
          <label htmlFor="j-city">City</label>
          <select id="j-city" name="city" required defaultValue="">
            <option value="" disabled>
              Select your city
            </option>
            {site.cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {track === "rider" && (
          <div className="field">
            <label htmlFor="j-bike">Do you have a motorcycle?</label>
            <select id="j-bike" name="bike" defaultValue="Yes">
              <option>Yes</option>
              <option>No — I&apos;d like to ride a Vendo bike</option>
            </select>
          </div>
        )}
        {track === "vendor" && (
          <div className="field">
            <label htmlFor="j-business">Business name &amp; type</label>
            <input id="j-business" name="business" required placeholder="e.g. Mama's Kitchen — restaurant" />
          </div>
        )}
        {track === "invest" && (
          <div className="field">
            <label htmlFor="j-option">Preferred bike</label>
            <select id="j-option" name="option" defaultValue="Electric — Spiro Ekon 450">
              <option>Electric — Spiro Ekon 450</option>
              <option>Fuel — QLINK XP / Champion 200</option>
              <option>Not sure yet</option>
            </select>
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor="j-note">Anything else? (optional)</label>
        <textarea id="j-note" name="note" style={{ minHeight: 100 }} />
      </div>
      <button type="submit" className="btn btn--primary">
        Apply on WhatsApp <Send className="arrow" />
      </button>
      <p className="form__note">Opens WhatsApp with your details filled in. Our team will reply with next steps.</p>
    </form>
  );
}
