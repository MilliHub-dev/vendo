// Single place for company details used across the site.
// Contact details come from the Vendo "Book us Now" flyer; verify social URLs before launch.

export const site = {
  name: "Vendo",
  legalName: "Vendo Limited",
  tagline: "Fast, Reliable Delivery Services",
  description:
    "Vendo delivers food from local vendors and sends packages by bike across Abuja, Kaduna, Kano and Lagos — tracked live and confirmed with a one-time code.",
  email: "Vendoltdnig@gmail.com",
  phones: ["08144461726", "08140454988"],
  whatsapp: "2348144461726", // international format, no "+"
  address: "No. 15 Kawo Road, Kaduna, Nigeria",
  cities: ["Abuja", "Kaduna", "Kano", "Lagos"],
  handle: "@Vendoltd",
  socials: {
    instagram: "https://instagram.com/vendoltd",
    tiktok: "https://www.tiktok.com/@vendoltd",
    facebook: "https://facebook.com/vendoltd",
  },
};

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${site.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telLink(phone: string) {
  return `tel:+234${phone.replace(/^0/, "")}`;
}

export const nav = [
  { href: "/", label: "Home" },
  { href: "/about/", label: "About Us" },
  { href: "/join/", label: "Join Us" },
  { href: "/contact/", label: "Contact" },
];

export const footerLinks = {
  Company: [
    { href: "/about/", label: "About us" },
    { href: "/careers/", label: "Careers" },
    { href: "/download/", label: "Download" },
  ],
  "Get involved": [
    { href: "/join/#riders", label: "Ride with Vendo" },
    { href: "/join/#vendors", label: "Sell on Vendo" },
    { href: "/join/#invest", label: "Own a Vendo bike" },
    { href: "/contact/", label: "Contact" },
  ],
  Legal: [
    { href: "/terms/", label: "Terms of Service" },
    { href: "/privacy/", label: "Privacy Policy" },
    { href: "/licenses/", label: "Licenses" },
  ],
};

// Legal pages are templates until reviewed by counsel. Flip to false once approved.
export const LEGAL_DRAFT = true;
export const LEGAL_UPDATED = "30 September 2026";
