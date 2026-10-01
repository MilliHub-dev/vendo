import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <section className="page-hero" style={{ minHeight: "70vh" }}>
      <div className="container center">
        <span className="eyebrow eyebrow--blue">404</span>
        <h1 className="h-1">This Route Doesn&apos;t Exist.</h1>
        <p className="lead">Even our best riders couldn&apos;t find this page.</p>
        <div className="page-hero__actions" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn btn--primary">
            Back to home <ArrowRight className="arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}
