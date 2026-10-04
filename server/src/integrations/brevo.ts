import { z } from 'zod';
import { ApiError } from '../lib/errors.js';

export interface SmsSender { send(phone: string, otp: string): Promise<void> }
export interface EmailMessage { to: string; subject: string; text: string }
export interface EmailSender { send(message: EmailMessage): Promise<void> }

async function send(path: string, apiKey: string, body: unknown, responseSchema: z.ZodType, code: string, message: string, timeout: number): Promise<void> {
  try {
    const response = await fetch(`https://api.brevo.com/v3/${path}`, {
      method: 'POST', signal: AbortSignal.timeout(timeout),
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json();
    if (!response.ok || !responseSchema.safeParse(payload).success) throw new Error('Message rejected');
  } catch { throw new ApiError(503, code, message); }
}

export function createBrevoSmsSender(apiKey: string, sender: string): SmsSender {
  return {
    async send(phone, otp) {
      await send('transactionalSMS/send', apiKey, {
        sender, recipient: phone.replace(/^\+/, ''),
        content: `Your Vendo verification code is ${otp}. Do not share it with anyone.`,
        type: 'transactional', tag: 'phone-verification',
      }, z.object({ messageId: z.union([z.number().int().positive(), z.string().min(1)]) }),
      'SMS_UNAVAILABLE', 'Verification messages are temporarily unavailable.', 2500);
    },
  };
}

export function createBrevoEmailSender(apiKey: string, senderEmail: string, senderName: string): EmailSender {
  return {
    async send(message) {
      const parsed = z.object({ to: z.email(), subject: z.string().min(1).max(255), text: z.string().min(1) }).safeParse(message);
      if (!parsed.success) throw new ApiError(400, 'INVALID_EMAIL_MESSAGE', 'Invalid email message.');
      await send('smtp/email', apiKey, {
        sender: { email: senderEmail, name: senderName }, to: [{ email: parsed.data.to }],
        subject: parsed.data.subject, textContent: parsed.data.text,
      }, z.object({ messageId: z.string().min(1) }),
      'EMAIL_UNAVAILABLE', 'Email delivery is temporarily unavailable.', 5000);
    },
  };
}

export function createBrevoAlertSender(apiKey:string,sender:string) {
  return { async sendText(phone:string,text:string) {
    await send('transactionalSMS/send',apiKey,{sender,recipient:phone.replace(/^\+/,''),content:text,type:'transactional',tag:'vendo-alert'},
      z.object({messageId:z.union([z.number().int().positive(),z.string().min(1)])}),'SMS_UNAVAILABLE','SMS delivery is temporarily unavailable.',5000);
  }};
}

// Template must be approved for utility alerts with one MESSAGE attribute.
export function createBrevoWhatsAppSender(apiKey:string,sender:string,templateId:number) {
  return {async sendText(phone:string,text:string){
    await send('whatsapp/sendMessage',apiKey,{senderNumber:sender.replace(/^\+/,''),contactNumbers:[phone.replace(/^\+/,'')],templateId,params:{MESSAGE:text}},
      z.object({messageId:z.string().min(1)}),'WHATSAPP_UNAVAILABLE','WhatsApp delivery is temporarily unavailable.',5000);
  }};
}
