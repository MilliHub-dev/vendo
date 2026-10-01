"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, MapPin, Package } from "lucide-react";
import { whatsappLink } from "@/lib/site";
import { WhatsAppIcon } from "./BrandIcons";

// Until the app launches, bookings are handled on WhatsApp: this pre-fills the chat.
export function BookingBar() {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const lines = ["Hi Vendo, I'd like to send a package."];
    if (pickup) lines.push(`Pickup: ${pickup}`);
    if (dropoff) lines.push(`Delivery: ${dropoff}`);
    window.open(whatsappLink(lines.join("\n")), "_blank", "noopener");
  }

  return (
    <>
      <form className="booking" onSubmit={submit}>
        <label className="booking__field">
          <Package aria-hidden />
          <span className="sr-only">Pickup location</span>
          <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Enter pickup location" autoComplete="street-address" />
        </label>
        <span className="booking__divider" aria-hidden />
        <label className="booking__field">
          <MapPin aria-hidden />
          <span className="sr-only">Delivery location</span>
          <input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Enter delivery location" />
        </label>
        <button className="booking__go" type="submit" aria-label="Book this delivery on WhatsApp">
          <span className="booking__go-label">Book on WhatsApp</span>
          <ArrowRight size={22} />
        </button>
      </form>
      <p className="booking__hint">
        <WhatsAppIcon /> We&apos;ll confirm your price and rider on WhatsApp.
      </p>
    </>
  );
}
