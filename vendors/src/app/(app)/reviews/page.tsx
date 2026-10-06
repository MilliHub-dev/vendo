"use client";

import { Star } from "lucide-react";

import { useReviews, useStore } from "@/api/queries";
import { Empty, Spinner } from "@/components/ui";
import { dayLabel } from "@/lib/dates";

export default function ReviewsPage() {
  const reviews = useReviews();
  const store = useStore();
  const s = store.data;
  if (reviews.isError || store.isError) return <p className="note note--danger">{reviews.error?.message ?? store.error?.message}</p>;
  if (!reviews.data || !s) return <Spinner />;

  const counts = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.data.filter((r) => r.rating === n).length }));
  const total = reviews.data.length || 1;

  return (
    <>
      {s.ratingCount ? (
        <section className="card row" style={{ gap: 28, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, color: "var(--heading)" }}>{s.rating.toFixed(1)}</div>
            <Stars rating={Math.round(s.rating)} />
            <div className="small muted">From {s.ratingCount} ratings</div>
          </div>
          <div className="grow stack-sm" style={{ minWidth: 220 }} aria-label="Recent reviews by star rating">
            {counts.map(({ n, count }) => (
              <div key={n} className="row small">
                <span style={{ width: 28 }}>{n} ★</span>
                <div className="grow" style={{ height: 8, borderRadius: 4, background: "var(--surface-2)" }}>
                  <div style={{ width: `${(count / total) * 100}%`, height: 8, borderRadius: 4, background: "#e8a92c" }} />
                </div>
                <span className="muted" style={{ width: 20, textAlign: "right" }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {reviews.data.length === 0 ? (
        <section className="card">
          <Empty icon={<Star />} title="No reviews yet">
            Customers can rate their order after it’s delivered. Their reviews will show here.
          </Empty>
        </section>
      ) : (
        <section className="card">
          <div className="list">
            {reviews.data.map((r) => (
              <article key={r.id} className="stack-sm" style={{ padding: "14px 0" }}>
                <div className="between">
                  <span className="strong">{r.customerName}</span>
                  <span className="small subtle">{dayLabel(new Date(r.createdAt))}</span>
                </div>
                <Stars rating={r.rating} />
                <p className="muted">{r.comment}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} fill={n <= rating ? "currentColor" : "none"} />
      ))}
    </span>
  );
}
