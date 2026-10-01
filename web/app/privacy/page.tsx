import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy", description: "How Vendo collects, uses and protects your personal data." };

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <p>
        {site.legalName} (&quot;Vendo&quot;) is the data controller for personal data processed through our apps, website and services. We process
        personal data in line with the Nigeria Data Protection Act 2023 (NDPA) and guidance from the Nigeria Data Protection Commission (NDPC).
      </p>
    ),
  },
  {
    id: "collect",
    title: "Data we collect",
    body: (
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Examples</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Account</td><td>Name, phone number, email, city, referral code.</td></tr>
          <tr><td>Orders</td><td>Pickup and delivery addresses, items, receiver name and phone, notes, ratings.</td></tr>
          <tr><td>Location</td><td>Delivery addresses you enter. For riders: live GPS location while online and on a trip.</td></tr>
          <tr><td>Payments</td><td>Wallet transactions and payment references. Card details are handled by Paystack, not stored by Vendo.</td></tr>
          <tr><td>Rider verification</td><td>Government ID, motorcycle registration, profile photo, bank account for payouts.</td></tr>
          <tr><td>Device</td><td>Device type, app version, push notification token, crash and diagnostic logs.</td></tr>
          <tr><td>Communications</td><td>Messages you send us on WhatsApp, email or in-app support.</td></tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To create your account, take orders, match riders, calculate prices and complete deliveries (performance of a contract).</li>
        <li>To process payments, prevent fraud and verify riders (legal obligation and legitimate interest).</li>
        <li>To send order updates by push, SMS or WhatsApp — WhatsApp messages only if you opt in (consent).</li>
        <li>To support you, improve our services and keep them secure (legitimate interest).</li>
        <li>To send promotions, only where you have agreed; you can opt out at any time (consent).</li>
      </ul>
    ),
  },
  {
    id: "share",
    title: "Who we share it with",
    body: (
      <>
        <p>We share only what is needed:</p>
        <ul>
          <li><strong>Riders and vendors</strong> — the name, phone number, address and order details required to fulfil your order.</li>
          <li><strong>Service providers</strong> — payments (Paystack), maps (Google Maps), hosting and databases, push notifications (Firebase Cloud Messaging), SMS (e.g. Termii) and WhatsApp messaging providers.</li>
          <li><strong>Authorities</strong> — where required by law or to protect the safety of our users.</li>
        </ul>
        <p>We do not sell your personal data. Some providers may process data outside Nigeria; where they do, we rely on safeguards permitted under the NDPA.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <p>
        We keep account data while your account is active, and order and payment records for as long as required for tax, accounting and legal
        purposes. Rider live GPS points are not stored during a trip; we keep only a summary of the completed route (distance, duration and a
        simplified path).
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        We use encryption in transit, access controls, private storage for rider documents and hashed delivery codes. No system is perfectly
        secure, but we work to protect your data and will notify you and the NDPC of a breach where the law requires.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the NDPA you can ask us to:</p>
        <ul>
          <li>access, correct or delete your personal data;</li>
          <li>restrict or object to certain processing, or withdraw consent;</li>
          <li>provide your data in a portable format.</li>
        </ul>
        <p>
          Email <a href={`mailto:${site.email}`}>{site.email}</a> to make a request. You may also complain to the Nigeria Data Protection
          Commission.
        </p>
      </>
    ),
  },
  {
    id: "website",
    title: "This website",
    body: (
      <p>
        This website does not use advertising or analytics cookies. The map on our Contact page is provided by Google, which may set its own
        cookies when it loads. Forms on this site open WhatsApp or your email app — nothing is stored on our servers until you send the message.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Our services are not intended for anyone under 18, and we do not knowingly collect their data.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about privacy? Email <a href={`mailto:${site.email}`}>{site.email}</a> or write to {site.legalName}, {site.address}.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return <LegalPage eyebrow="Legal" title="Privacy Policy" lead="How Vendo collects, uses and protects your personal data." sections={sections} />;
}
