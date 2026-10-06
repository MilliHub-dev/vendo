import type { Notification } from '../modules/notifications/schema.js';

export type RenderedEmail = { subject: string; text: string; html: string };
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const sections: Record<string, string> = {
  welcome: 'YOUR ACCOUNT', order: 'YOUR DELIVERY', payment: 'PAYMENT UPDATE', refund: 'REFUND UPDATE',
  reminder: 'SCHEDULED DELIVERY', no_rider: 'DELIVERY MATCHING', vendor: 'YOUR STORE', vendor_order: 'NEW STORE ORDER',
  rider_offer: 'DELIVERY OFFER', support: 'SUPPORT UPDATE', withdrawal: 'PAYOUT UPDATE',
};

// Vendo brand: blue #0064FF, navy #0A1633. The wordmark is the white logo on a blue band; if a mail
// app blocks images, its alt text ("Vendo", styled white and bold) shows in its place.
const BLUE = '#0064FF', NAVY = '#0A1633', MUTED = '#5B6781', LINE = '#E3E8F2', PAGE = '#F4F7FC', SOFT = '#EAF2FF';
const LOGO_URL = 'https://www.vendoltd.com/brand/logo-white.png';
const codeBox = (code: string) => `<p style="margin:24px 0;padding:22px 12px;text-align:center;background:${SOFT};border:1px solid #C5DCFF;border-radius:14px;font-size:34px;font-weight:bold;letter-spacing:10px;color:${BLUE}">${code}</p>`;

function layout(subject: string, section: string, content: string, preheader: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(subject)}</title></head><body style="margin:0;background:${PAGE};font-family:Arial,Helvetica,sans-serif;color:${NAVY}"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:18px;overflow:hidden"><tr><td bgcolor="${BLUE}" style="padding:26px 32px;background:${BLUE};border-radius:18px 18px 0 0"><img src="${LOGO_URL}" width="132" height="32" alt="Vendo" style="display:block;border:0;outline:none;height:32px;width:132px;color:#ffffff;font-size:26px;font-weight:bold;font-family:Arial,Helvetica,sans-serif"></td></tr><tr><td style="padding:32px"><p style="margin:0 0 12px;font-size:11px;letter-spacing:2px;font-weight:bold;color:${BLUE}">${escape(section)}</p><h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:${NAVY}">${escape(subject)}</h1>${content}</td></tr><tr><td style="padding:22px 32px;border-top:1px solid ${LINE};background:${PAGE};font-size:12px;line-height:1.6;color:${MUTED}">Sent by Vendo Limited &middot; Food delivery and bike dispatch.<br>Never share your sign-in, verification or delivery codes with anyone who contacts you unexpectedly.</td></tr></table></td></tr></table></body></html>`;
}

export function verificationEmail(code: string): RenderedEmail {
  if (!/^\d{6}$/.test(code)) throw new Error('A six-digit verification code is required.');
  const subject = 'Verify your Vendo email';
  const text = `Your Vendo email verification code is ${code}. It expires in 10 minutes. Do not share it with anyone.`;
  const content = `<p style="font-size:16px;line-height:1.6">Enter this code in Vendo to verify your email address.</p>${codeBox(code)}<p style="font-size:14px;line-height:1.6">This code expires in <strong>10 minutes</strong>. If you did not request it, ignore this email. Do not share this code.</p>`;
  return { subject, text, html: layout(subject, 'EMAIL VERIFICATION', content, 'Your email verification code expires in 10 minutes.') };
}

/** The sign-in code. Supabase generates it; we send it ourselves through Brevo so delivery doesn't depend on Supabase's mail service. */
export function signInCodeEmail(code: string): RenderedEmail {
  if (!/^\d{6}$/.test(code)) throw new Error('A six-digit sign-in code is required.');
  const subject = `${code} is your Vendo sign-in code`;
  const text = `Your Vendo sign-in code is ${code}. Enter it in the app to continue. It expires soon and works once. Do not share it with anyone.`;
  const content = `<p style="font-size:16px;line-height:1.6">Enter this code in Vendo to sign in.</p>${codeBox(code)}<p style="font-size:14px;line-height:1.6">The code expires soon and works once. If you did not ask to sign in, ignore this email. Vendo staff will never ask you for this code.</p>`;
  return { subject, text, html: layout(subject, 'SIGN-IN CODE', content, 'Your Vendo sign-in code. It works once.') };
}
export function notificationEmail(notification: Pick<Notification, 'kind' | 'title' | 'body' | 'order_id'>): RenderedEmail {
  const reference = notification.order_id ? `\nOrder reference: ${notification.order_id}` : '';
  const text = `${notification.body}${reference}\n\nOpen Vendo to view the latest details.`;
  const content = `<p style="font-size:16px;line-height:1.7">${escape(notification.body).replace(/\n/g, '<br>')}</p>${notification.order_id ? `<p style="padding:16px;background:${PAGE};border:1px solid ${LINE};border-radius:10px;font-size:12px;line-height:1.6;word-break:break-all"><strong>Order reference</strong><br>${escape(notification.order_id)}</p>` : ''}<p style="margin-top:24px;font-size:14px;line-height:1.6;color:${MUTED}">Open the Vendo app to view the latest details.</p>`;
  return { subject: notification.title, text, html: layout(notification.title, sections[notification.kind] ?? 'VENDO UPDATE', content, notification.body.slice(0, 160)) };
}
