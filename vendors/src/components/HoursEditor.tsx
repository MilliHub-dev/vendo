"use client";

import type { DayHours } from "@/api/types";
import { DAY_NAMES, formatHour } from "@/lib/orders";

import { Switch } from "./ui";

const TIMES = Array.from({ length: 20 }, (_, i) => `${String(i + 5).padStart(2, "0")}:00`); // 05:00 … 24:00
const display = (t: string) => (t === "24:00" ? "12:00 AM" : formatHour(t));

/** Opening hours, one row per day: an open/closed switch and the opening and closing times. */
export function HoursEditor({ value, onChange }: { value: DayHours[]; onChange: (hours: DayHours[]) => void }) {
  const set = (day: number, patch: Partial<DayHours>) => onChange(value.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  const ordered = [...value].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)); // Monday first

  return (
    <div className="hours">
      {ordered.map((d) => (
        <div key={d.day} className="hours__row">
          <span className={d.open ? "strong" : "subtle"}>{DAY_NAMES[d.day]}</span>
          {d.open ? (
            <div className="hours__times">
              <select className="select" aria-label={`${DAY_NAMES[d.day]} opens at`} value={d.from} onChange={(e) => set(d.day, { from: e.target.value })}>
                {TIMES.filter((t) => t < d.to).map((t) => (
                  <option key={t} value={t}>
                    {display(t)}
                  </option>
                ))}
              </select>
              <span className="subtle">to</span>
              <select className="select" aria-label={`${DAY_NAMES[d.day]} closes at`} value={d.to} onChange={(e) => set(d.day, { to: e.target.value })}>
                {[...TIMES.slice(1), "24:00"].filter((t) => t > d.from).map((t) => (
                  <option key={t} value={t}>
                    {display(t)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="subtle">Closed</span>
          )}
          <Switch checked={d.open} onChange={(open) => set(d.day, { open })} label={`Open on ${DAY_NAMES[d.day]}`} />
        </div>
      ))}
    </div>
  );
}
