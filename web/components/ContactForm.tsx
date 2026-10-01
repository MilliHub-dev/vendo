"use client";

import { FormEvent, useState } from "react";
import { Mail, Send } from "lucide-react";
import { site, whatsappLink } from "@/lib/site";
import { WhatsAppIcon } from "./BrandIcons";

const topics = ["Book a delivery", "Order support", "Become a rider", "Vendor partnership", "Bike ownership / investment", "Careers", "Something else"];

// No backend yet: the form hands the message off to WhatsApp or the user's email app.
export function ContactForm() {
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "");
    const phone = String(f.get("phone") || "");
    const city = String(f.get("city") || "");
    const topic = String(f.get("topic") || "");
    const message = String(f.get("message") || "");
    const details = [`Name: ${name}`];
    if (phone) details.push(`Phone: ${phone}`);
    if (city) details.push(`City: ${city}`);
    details.push(`Topic: ${topic}`);
    const body = `${details.join("\n")}\n\n${message}`;
    if (channel === "whatsapp") {
      window.open(whatsappLink(`Hi Vendo,\n${body}`), "_blank", "noopener");
    } else {
      window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(`[Website] ${topic}`)}&body=${encodeURIComponent(body)}`;
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form__row">
        <div className="field">
          <label htmlFor="c-name">Full name</label>
          <input id="c-name" name="name" required autoComplete="name" placeholder="e.g. Amina Bello" />
        </div>
        <div className="field">
          <label htmlFor="c-phone">Phone number</label>
          <input id="c-phone" name="phone" type="tel" autoComplete="tel" placeholder="080..." />
        </div>
      </div>
      <div className="form__row">
        <div className="field">
          <label htmlFor="c-city">City</label>
          <select id="c-city" name="city" defaultValue="">
            <option value="" disabled>
              Select your city
            </option>
            {site.cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
            <option>Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="c-topic">Topic</label>
          <select id="c-topic" name="topic" defaultValue={topics[0]}>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-message">Message</label>
        <textarea id="c-message" name="message" required placeholder="How can we help?" />
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 14, fontWeight: 500, color: "var(--heading)", marginBottom: 8 }}>Send via</legend>
        <div className="segmented">
          <label>
            <input type="radio" name="channel" checked={channel === "whatsapp"} onChange={() => setChannel("whatsapp")} />
            <span><WhatsAppIcon /> WhatsApp</span>
          </label>
          <label>
            <input type="radio" name="channel" checked={channel === "email"} onChange={() => setChannel("email")} />
            <span><Mail /> Email</span>
          </label>
        </div>
      </fieldset>
      <button type="submit" className="btn btn--primary">
        Send message <Send className="arrow" />
      </button>
      <p className="form__note">Your message opens in {channel === "whatsapp" ? "WhatsApp" : "your email app"} so you can review it before sending.</p>
    </form>
  );
}
