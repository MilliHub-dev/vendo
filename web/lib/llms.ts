import { homeFaqs, joinFaqs } from "./faq";
import { site } from "./site";

// llms.txt (https://llmstxt.org): a plain, factual summary for AI assistants and answer engines.
const u = (p: string) => `${site.url}${p}`;
const cities = site.cities.join(", ").replace(/, ([^,]*)$/, " and $1");

export function llmsTxt() {
  return `# ${site.legalName} (${site.name})

> ${site.description}

Vendo offers two services — food delivery (Food Court) and same-day motorcycle dispatch for parcels and documents — for individuals and businesses in ${cities}, Nigeria. Head office: ${site.address}. Bookings are currently taken on WhatsApp (+${site.whatsapp}); the Vendo customer app and the Vendo Rider app (iOS and Android) are coming soon.

## Key facts
- Company: ${site.legalName}, a Nigerian delivery and logistics company
- Services: food delivery from local vendors; same-day bike dispatch; scheduled deliveries; business delivery
- Cities: ${cities}
- Pricing: by distance and package size (document, small parcel, large parcel); price shown before booking
- Delivery confirmation: one-time delivery code for dispatch orders
- Payments: Paystack (card, bank transfer, USSD) and a Vendo Wallet in the app
- Contact: WhatsApp/phone ${site.phones.join(", ")}; email ${site.email}; social ${site.handle} (Instagram, TikTok, Facebook)

## Pages
- [Home](${u("/")}): services, how delivery works, pricing by package size, FAQ
- [About Vendo](${u("/about/")}): mission, vision, values, cities served
- [Join Us](${u("/join/")}): become a rider, sell as a vendor, or own a Vendo commercial motorcycle (fuel ₦1,399,000 → ₦6,000/day; electric ₦1,745,000 → ₦8,000/day)
- [Contact](${u("/contact/")}): WhatsApp, phone, email, office address and map
- [Download](${u("/download/")}): Vendo and Vendo Rider apps (coming soon)
- [Careers](${u("/careers/")}): teams Vendo hires for

## Optional
- [Full text for AI assistants](${u("/llms-full.txt")})
- [Terms of Service](${u("/terms/")})
- [Privacy Policy](${u("/privacy/")})
`;
}

export function llmsFullTxt() {
  const qa = (list: { q: string; a: string }[]) => list.map((f) => `### ${f.q}\n${f.a}`).join("\n\n");
  return `${llmsTxt()}
## Frequently asked questions — customers
${qa(homeFaqs)}

## Frequently asked questions — riders, vendors and bike owners
${qa(joinFaqs)}

## How a delivery works
1. Book: say what to deliver and where; see the price before you confirm.
2. Get matched: the nearest available rider is offered the order.
3. Track live: follow the rider from pickup to the door (in the Vendo app).
4. Confirm with a code: the receiver shares a one-time code with the rider on delivery.

## Rider requirements
Valid government-issued ID; motorcycle registration papers (or ride a Vendo bike); a profile photo; an Android smartphone with data.

## Vendor membership tiers
Basic (get listed), Standard (better placement), Premium (top placement and promotional banners). Commission depends on tier and city.
`;
}
