import type { Notification } from '../modules/notifications/schema.js';

export type RenderedEmail = { subject: string; text: string; html: string };
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const sections: Record<string, string> = {
  welcome: 'YOUR ACCOUNT', order: 'YOUR DELIVERY', payment: 'PAYMENT UPDATE', refund: 'REFUND UPDATE',
  reminder: 'SCHEDULED DELIVERY', no_rider: 'DELIVERY MATCHING', vendor: 'YOUR STORE', vendor_order: 'NEW STORE ORDER',
  rider_offer: 'DELIVERY OFFER', support: 'SUPPORT UPDATE', withdrawal: 'PAYOUT UPDATE',
};

function layout(subject: string, section: string, content: string, preheader: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#172033"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e5e7eb;border-radius:16px"><tr><td style="padding:28px 32px;border-bottom:1px solid #e5e7eb"><span style="font-size:28px;font-weight:bold;color:#f97316">Vendo</span></td></tr><tr><td style="padding:32px"><p style="margin:0 0 12px;font-size:11px;letter-spacing:2px;font-weight:bold;color:#687385">${escape(section)}</p><h1 style="margin:0 0 20px;font-size:26px;line-height:1.3">${escape(subject)}</h1>${content}</td></tr><tr><td style="padding:24px 32px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;color:#687385">Sent by Vendo. Never share your verification or delivery codes with anyone who contacts you unexpectedly.</td></tr></table></td></tr></table></body></html>`;
}

export function verificationEmail(code: string): RenderedEmail {
  if (!/^\d{6}$/.test(code)) throw new Error('A six-digit verification code is required.');
  const subject = 'Verify your Vendo email';
  const text = `Your Vendo email verification code is ${code}. It expires in 10 minutes. Do not share it with anyone.`;
  const content = `<p style="font-size:16px;line-height:1.6">Enter this code in Vendo to verify your email address.</p><p style="padding:20px;text-align:center;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p><p style="font-size:14px;line-height:1.6">This code expires in <strong>10 minutes</strong>. If you did not request it, ignore this email. Do not share this code.</p>`;
  return { subject, text, html: layout(subject, 'EMAIL VERIFICATION', content, 'Your email verification code expires in 10 minutes.') };
}

export function notificationEmail(notification: Pick<Notification, 'kind' | 'title' | 'body' | 'order_id'>): RenderedEmail {
  const reference = notification.order_id ? `\nOrder reference: ${notification.order_id}` : '';
  const text = `${notification.body}${reference}\n\nOpen Vendo to view the latest details.`;
  const content = `<p style="font-size:16px;line-height:1.7">${escape(notification.body).replace(/\n/g, '<br>')}</p>${notification.order_id ? `<p style="padding:16px;background:#f5f6f8;border-radius:8px;font-size:12px;line-height:1.6;word-break:break-all"><strong>Order reference</strong><br>${escape(notification.order_id)}</p>` : ''}<p style="margin-top:24px;font-size:14px;line-height:1.6">Open Vendo to view the latest details.</p>`;
  return { subject: notification.title, text, html: layout(notification.title, sections[notification.kind] ?? 'VENDO UPDATE', content, notification.body.slice(0, 160)) };
}
