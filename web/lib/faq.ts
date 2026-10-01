import { site } from "./site";

// Shown on the page AND emitted as FAQPage structured data + in llms.txt,
// so answers must stay accurate. Keep app-related answers honest about launch status.
export type Faq = { q: string; a: string };

const cities = site.cities.join(", ").replace(/, ([^,]*)$/, " and $1");

export const homeFaqs: Faq[] = [
  {
    q: "What does Vendo do?",
    a: `Vendo is a Nigerian delivery company. We deliver food from local restaurants and vendors (Food Court) and send documents and parcels across town by motorcycle (Dispatch), for individuals and businesses in ${cities}.`,
  },
  {
    q: "Which cities does Vendo deliver in?",
    a: `Vendo operates in ${cities}. Our head office is at ${site.address}.`,
  },
  {
    q: "How do I book a delivery with Vendo?",
    a: `Message us on WhatsApp (${site.phones[0]}) with your pickup and delivery locations, or use the booking form on our website. We confirm the price and assign a rider. The Vendo app for iPhone and Android is coming soon.`,
  },
  {
    q: "How much does a Vendo delivery cost?",
    a: "Delivery is priced by distance and package size (document, small parcel or large parcel), and pricing can differ by city. You always see the full price before you confirm — there are no hidden fees.",
  },
  {
    q: "What can I send with Vendo Dispatch?",
    a: "Documents, envelopes and parcels that fit safely in a Vendo motorcycle delivery box. We don't carry illegal goods, weapons, cash, live animals or hazardous items.",
  },
  {
    q: "How is a dispatch delivery confirmed?",
    a: "Each dispatch order has a one-time delivery code. The receiver shares it with the rider only when the item is in their hands, and the rider enters it to complete the delivery.",
  },
  {
    q: "Can I schedule a delivery for later?",
    a: "Yes. Choose a date and time and Vendo starts matching a rider shortly before the pickup time.",
  },
  {
    q: "How do I pay?",
    a: "Payments are processed securely by Paystack: card, bank transfer or USSD, plus a Vendo Wallet you can top up in the app. For WhatsApp bookings our team confirms the payment options with you.",
  },
];

export const joinFaqs: Faq[] = [
  {
    q: "How do I become a Vendo rider?",
    a: "Apply on the Join Us page or on WhatsApp, then provide a valid government ID, motorcycle registration papers (or ride a Vendo bike) and a profile photo. After review and approval you can go online and start accepting deliveries.",
  },
  {
    q: "How do Vendo riders get paid?",
    a: "Rider earnings are credited to a Vendo wallet and can be withdrawn to any Nigerian bank account.",
  },
  {
    q: "How can my restaurant or shop sell on Vendo?",
    a: "Apply as a vendor. Restaurants, fast food spots, drink shops, grocers and pharmacies can list on Vendo; our team uploads your menu, and Vendo riders handle delivery. Commission depends on your membership tier (Basic, Standard or Premium) and city.",
  },
  {
    q: "What is the Vendo motorcycle ownership programme?",
    a: "You buy a commercial motorcycle that is deployed in Vendo's delivery fleet and receive a fixed daily payment: a fuel QLINK XP / Champion 200 costs ₦1,399,000 with a ₦6,000 daily payment, and an electric Spiro Ekon 450 costs ₦1,745,000 with an ₦8,000 daily payment. Each bike includes a helmet, a Vendo delivery box and tracking. Full terms are in the investment agreement.",
  },
];
