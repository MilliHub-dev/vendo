import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt } from 'node:crypto';
import { ApiError } from '../../lib/errors.js';

export class DeliveryCodes {
  constructor(private readonly secret?: string) {}
  private key(purpose: string) {
    if (!this.secret) throw new ApiError(503, 'DELIVERY_CODES_NOT_CONFIGURED', 'Dispatch delivery codes are not configured.');
    return createHmac('sha256', this.secret).update(`dispatch:v1:${purpose}`).digest();
  }
  hash(orderId: string, code: string) { return createHmac('sha256', this.key('hash')).update(`${orderId}:${code}`).digest('hex'); }
  generate(orderId: string) {
    const code = randomInt(0, 10000).toString().padStart(4, '0');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key('encrypt'), iv);
    cipher.setAAD(Buffer.from(orderId));
    const data = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    return { encrypted: Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64'), hash: this.hash(orderId, code) };
  }
  decrypt(orderId: string, encrypted: string) {
    const key = this.key('encrypt');
    try {
      const data = Buffer.from(encrypted, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
      decipher.setAAD(Buffer.from(orderId)); decipher.setAuthTag(data.subarray(12, 28));
      return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
    } catch { throw new ApiError(503, 'DELIVERY_CODE_UNAVAILABLE', 'Delivery code is temporarily unavailable.'); }
  }
}
