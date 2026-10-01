import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service", description: "The terms that apply when you use Vendo's apps, website and delivery services." };

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "About these terms",
    body: (
      <>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of the Vendo customer app, the Vendo Rider app, this website and any
          delivery, food-ordering or dispatch service provided by {site.legalName} (&quot;Vendo&quot;, &quot;we&quot;, &quot;us&quot;), whether
          booked in-app, on WhatsApp or by phone. By using our services you agree to these Terms. If you do not agree, please do not use them.
        </p>
      </>
    ),
  },
  {
    id: "services",
    title: "Our services",
    body: (
      <>
        <p>Vendo provides two main services in the cities where we operate ({site.cities.join(", ")}):</p>
        <ul>
          <li><strong>Food Court</strong> — ordering food and goods from independent vendors listed on Vendo, delivered by a Vendo rider.</li>
          <li><strong>Dispatch</strong> — pickup and delivery of documents and parcels by motorcycle.</li>
        </ul>
        <p>
          Vendors are independent businesses responsible for the food and goods they prepare and sell. Riders may be independent contractors.
          Service availability, hours and coverage can vary by city.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <>
        <p>
          You sign up with your phone number and a one-time verification code. You must be at least 18 years old, give accurate information and
          keep your account secure. You are responsible for activity on your account. Tell us immediately if you suspect unauthorised use.
        </p>
      </>
    ),
  },
  {
    id: "orders",
    title: "Orders, pricing and delivery",
    body: (
      <>
        <ul>
          <li>Delivery fees are calculated by distance and may vary by city, package size and demand (including peak-time pricing).</li>
          <li>The total price is shown before you confirm. The price confirmed at checkout is the price you pay.</li>
          <li>Delivery times are estimates. Traffic, weather, vendor preparation time and rider availability can cause delays.</li>
          <li>
            For dispatch orders, a one-time delivery code is shown to you. Only share it with the rider once the item is in the receiver&apos;s
            hands — sharing the code confirms delivery.
          </li>
          <li>Scheduled orders are held until shortly before the chosen time, when rider matching begins.</li>
        </ul>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments and the Vendo Wallet",
    body: (
      <>
        <p>
          Payments are processed by our payment partner, Paystack. You can pay by card, bank transfer, USSD or your Vendo Wallet balance. We do
          not store your full card details.
        </p>
        <ul>
          <li>Customer wallet balances are for use on Vendo services and cannot be withdrawn as cash.</li>
          <li>Rider earnings are credited to the rider wallet and may be withdrawn to a Nigerian bank account, subject to a minimum amount.</li>
          <li>We may reverse credits made in error or through fraud.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cancellations",
    title: "Cancellations and refunds",
    body: (
      <>
        <p>
          You can cancel an order before it is picked up. Once a vendor has started preparing food or a rider has been dispatched, a cancellation
          fee may apply. If an order is not delivered, is significantly wrong, or you were charged in error, contact us within 48 hours — approved
          refunds are returned to your Vendo Wallet or original payment method.
        </p>
      </>
    ),
  },
  {
    id: "prohibited",
    title: "Prohibited items and conduct",
    body: (
      <>
        <p>You must not use Vendo to send or order:</p>
        <ul>
          <li>Illegal goods, weapons, explosives, drugs or controlled substances;</li>
          <li>Cash, precious metals or items of exceptional value;</li>
          <li>Live animals, hazardous or perishable items that cannot be safely carried on a motorcycle;</li>
          <li>Anything larger or heavier than fits safely in a Vendo delivery box.</li>
        </ul>
        <p>Riders may refuse any item they reasonably believe is prohibited or unsafe. Abuse or harassment of riders, vendors or staff is not tolerated.</p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    body: (
      <>
        <p>
          We take care in handling every delivery. To the extent permitted by law, our liability for loss of or damage to a dispatched item is
          limited to the delivery fee paid plus the declared value up to a maximum amount we publish from time to time, and we are not liable for
          indirect or consequential losses. Nothing in these Terms limits rights you have under Nigerian consumer protection law.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "Governing law and disputes",
    body: (
      <>
        <p>
          These Terms are governed by the laws of the Federal Republic of Nigeria. We&apos;ll always try to resolve issues with you directly
          first; unresolved disputes will be subject to the jurisdiction of the courts of Kaduna State.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <>
        <p>
          We may update these Terms. We&apos;ll post the new version here and, for significant changes, notify you in the app. Questions? Email{" "}
          <a href={`mailto:${site.email}`}>{site.email}</a> or write to {site.legalName}, {site.address}.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return <LegalPage eyebrow="Legal" title="Terms of Service" lead="The rules for using Vendo's apps, website and delivery services." sections={sections} />;
}
