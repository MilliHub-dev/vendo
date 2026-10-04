"use client";

import { Bell, Send } from "lucide-react";
import { useState } from "react";

import { api } from "@/api/client";
import { useAction, useAudienceCount, useBroadcasts, useCities } from "@/api/queries";
import type { Audience, Broadcast, PushLink } from "@/api/types";
import { Locked, useCan, useCityName } from "@/components/admin";
import { Badge, Button, Confirm, Empty, Input, Spinner, Textarea } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";

const audiences: { value: Audience; label: string; app: string }[] = [
  { value: "customers", label: "Customers", app: "Vendo" },
  { value: "riders", label: "Riders", app: "Vendo Rider" },
  { value: "vendors", label: "Vendors", app: "Vendo Vendor" },
];
const links: { value: PushLink; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "food", label: "Food Court" },
  { value: "send", label: "Send a package" },
  { value: "wallet", label: "Wallet" },
  { value: "orders", label: "My orders" },
];
const TITLE_MAX = 50;
const BODY_MAX = 160;
const statusTone = { sent: "success", scheduled: "primary", cancelled: undefined } as const;
const statusLabel = { sent: "Sent", scheduled: "Scheduled", cancelled: "Cancelled" };
/** value for <input type="datetime-local"> in local time */
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function NotificationsPage() {
  const canSend = useCan("notifications.send");
  const history = useBroadcasts();
  const cityName = useCityName();
  const [cancelling, setCancelling] = useState<Broadcast | null>(null);
  const cancel = useAction((id: string) => api.cancelBroadcast(id), ["broadcasts"]);

  return (
    <>
      {canSend ? <Composer /> : <Locked permission="notifications.send" what="send push notifications" />}

      <section className="card card--flush">
        <div className="card__head" style={{ padding: "18px 20px 0" }}>
          <div>
            <h2>History</h2>
            <p className="small muted">Everything sent or scheduled from this dashboard.</p>
          </div>
        </div>
        {!history.data ? (
          <Spinner />
        ) : history.data.length === 0 ? (
          <Empty icon={<Bell />} title="Nothing sent yet">Notifications you send show here.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Notification</th>
                  <th>To</th>
                  <th>When</th>
                  <th>Status</th>
                  <th className="num">Delivered</th>
                  <th className="num">Opened</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.data.map((b) => (
                  <tr key={b.id} data-new={b.status === "scheduled"}>
                    <td style={{ maxWidth: 360 }}>
                      <div className="strong">{b.title}</div>
                      <div className="small muted">{b.body}</div>
                    </td>
                    <td data-label="To">
                      <span style={{ textTransform: "capitalize" }}>{b.audience}</span>
                      <div className="small muted">{b.cityIds.map(cityName).join(", ")}</div>
                    </td>
                    <td className="muted" data-label="When">
                      {formatDateTime(b.sendAt)}
                      <div className="small">by {b.sentBy}</div>
                    </td>
                    <td><Badge tone={statusTone[b.status]}>{statusLabel[b.status]}</Badge></td>
                    <td className="num" data-label={b.status === "sent" ? "Delivered" : "Will reach"}>{b.status === "cancelled" ? "—" : b.recipients.toLocaleString("en-NG")}</td>
                    <td className="num" data-label="Opened">{b.status === "sent" ? `${b.opened.toLocaleString("en-NG")} (${Math.round((b.opened / b.recipients) * 100)}%)` : "—"}</td>
                    <td>
                      {b.status === "scheduled" && canSend ? (
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <Button size="sm" variant="secondary" onClick={() => setCancelling(b)}>Cancel</Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {cancelling ? (
        <Confirm title="Cancel this notification?" message={`“${cancelling.title}” won’t be sent. You can write it again later.`} confirmLabel="Cancel notification" danger loading={cancel.isPending} onClose={() => setCancelling(null)} onConfirm={() => cancel.mutate(cancelling.id, { onSuccess: () => setCancelling(null) })} />
      ) : null}
    </>
  );
}

function Composer() {
  const cities = useCities();
  const cityName = useCityName();
  const [audience, setAudience] = useState<Audience>("customers");
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState<PushLink>("home");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [sendAt, setSendAt] = useState(() => localInput(new Date(Date.now() + 3_600_000)));
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<Broadcast | null>(null);
  const count = useAudienceCount(audience, cityIds);
  const send = useAction(() => api.sendBroadcast({ title, body, audience, cityIds, link, sendAt: when === "later" ? new Date(sendAt).toISOString() : undefined }), ["broadcasts"]);

  const active = cities.data?.filter((c) => c.isActive) ?? [];
  const everywhere = active.length > 0 && active.every((c) => cityIds.includes(c.id));
  const reach = cityIds.length ? count.data : 0;
  const errors = {
    title: title.trim().length < 3 ? "Write a title" : null,
    body: body.trim().length < 10 ? "Write the message (at least 10 characters)" : null,
    cities: cityIds.length === 0 ? "Choose at least one city" : null,
    sendAt: when === "later" && !(new Date(sendAt).getTime() > Date.now() + 60_000) ? "Choose a time in the future" : null,
  };
  const valid = Object.values(errors).every((e) => !e) && !!reach;
  const people = `${(reach ?? 0).toLocaleString("en-NG")} ${reach === 1 ? audience.slice(0, -1) : audience}`;
  const app = audiences.find((a) => a.value === audience)!.app;

  return (
    <div className="grid-2 push">
      <section className="card stack">
        <div>
          <h2>New push notification</h2>
          <p className="small muted">Goes to people’s phones even when the app is closed. It can’t be recalled once sent.</p>
        </div>

        {done ? (
          <p className="note" style={{ color: "var(--success)" }} role="status">
            {done.status === "sent" ? `Sent “${done.title}” to ${done.recipients.toLocaleString("en-NG")} ${done.audience}.` : `Scheduled “${done.title}” for ${formatDateTime(done.sendAt)}.`}
          </p>
        ) : null}

        <div className="field">
          <span className="label">Send to</span>
          <div className="wrap" role="radiogroup" aria-label="Audience">
            {audiences.map((a) => (
              <button key={a.value} type="button" role="radio" className="chip" aria-checked={audience === a.value} onClick={() => setAudience(a.value)}>{a.label}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">In</span>
          <div className="wrap">
            <button type="button" className="chip" aria-pressed={everywhere} onClick={() => setCityIds(everywhere ? [] : active.map((c) => c.id))}>All cities</button>
            {active.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={cityIds.includes(c.id)} onClick={() => setCityIds((ids) => (ids.includes(c.id) ? ids.filter((i) => i !== c.id) : [...ids, c.id]))}>{c.name}</button>
            ))}
          </div>
          {touched && errors.cities ? <span className="field__error">{errors.cities}</span> : <span className="field__hint">{cityIds.length === 0 ? "Choose where this should go." : count.isFetching && reach === undefined ? "Counting…" : reach ? `Reaches about ${people} with notifications on.` : "Nobody matches — try another city."}</span>}
        </div>

        <Input label="Title" placeholder="e.g. Free delivery this weekend" maxLength={TITLE_MAX} value={title} onChange={(e) => (setTitle(e.target.value), setDone(null))} error={touched ? errors.title : null} hint={`${title.length}/${TITLE_MAX}`} />
        <Textarea label="Message" rows={3} placeholder="Say what’s happening and what to do next." maxLength={BODY_MAX} value={body} onChange={(e) => (setBody(e.target.value), setDone(null))} error={touched ? errors.body : null} hint={`${body.length}/${BODY_MAX} — phones cut off long messages, so put the important part first`} />

        {audience === "customers" ? (
          <div className="field">
            <label htmlFor="push-link">When tapped, open</label>
            <select id="push-link" className="select" value={link} onChange={(e) => setLink(e.target.value as PushLink)}>
              {links.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        ) : null}

        <div className="field">
          <span className="label">When</span>
          <div className="wrap" role="radiogroup" aria-label="When to send">
            <button type="button" role="radio" className="chip" aria-checked={when === "now"} onClick={() => setWhen("now")}>Send now</button>
            <button type="button" role="radio" className="chip" aria-checked={when === "later"} onClick={() => setWhen("later")}>Schedule for later</button>
          </div>
        </div>
        {when === "later" ? <Input label="Date and time" type="datetime-local" min={localInput(new Date())} value={sendAt} onChange={(e) => setSendAt(e.target.value)} error={touched ? errors.sendAt : null} /> : null}

        {send.isError ? <p className="text-danger">{send.error.message}</p> : null}
        <div>
          <Button onClick={() => (setTouched(true), valid && setConfirming(true))}>
            <Send /> {when === "now" ? "Send notification" : "Schedule notification"}
          </Button>
        </div>
      </section>

      <section className="card stack push__preview">
        <h2>Preview</h2>
        <div className="phone" aria-label="How the notification looks on a phone">
          <div className="phone__time">9:41</div>
          <div className="phone__push">
            <img src="/favicon.png" alt="" />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="between">
                <span className="phone__app">{app}</span>
                <span className="phone__app">now</span>
              </div>
              <div className="phone__title">{title.trim() || "Your title"}</div>
              <div className="phone__body">{body.trim() || "Your message shows here."}</div>
            </div>
          </div>
        </div>
        <p className="small muted">An approximation — each phone lays notifications out a little differently.</p>
      </section>

      {confirming ? (
        <Confirm
          title={when === "now" ? `Send to ${people}?` : `Schedule for ${people}?`}
          message={`“${title.trim()}” goes to ${audience} in ${cityIds.map(cityName).join(", ")}${when === "now" ? " straight away. It can’t be undone." : ` on ${formatDateTime(new Date(sendAt).toISOString())}. You can cancel it before then.`}`}
          confirmLabel={when === "now" ? "Send now" : "Schedule"}
          loading={send.isPending}
          onClose={() => setConfirming(false)}
          onConfirm={() =>
            send.mutate(undefined, {
              onSuccess: (b) => (setDone(b), setTitle(""), setBody(""), setTouched(false)),
              onSettled: () => setConfirming(false),
            })
          }
        />
      ) : null}
    </div>
  );
}
