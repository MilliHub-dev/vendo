import { ApiError } from '../../lib/errors.js';
import type { FinanceRepository, TransferGateway, AccountKind, BankInput } from './schema.js';
export class FinanceService {
    constructor(private readonly repo: FinanceRepository, private readonly provider: TransferGateway, private readonly enabled: boolean) { }
    async bank(user: string, kind: AccountKind, entity: string, input: BankInput) { await this.repo.account(user, kind, entity); if (!this.provider.configured)
        throw new ApiError(503, 'TRANSFERS_NOT_CONFIGURED', 'Bank verification is not configured.'); const resolved = await this.provider.resolve(input), recipient = await this.provider.recipient(input, resolved.account_name); return this.repo.saveBank(user, kind, entity, input, resolved.account_name, recipient); }
    async process(limit = 20) {
        const settled = await this.repo.settle(limit);
        let submitted = 0, verified = 0, review = 0;
        if (!this.enabled || !this.provider.configured)
            return { settled, submitted, verified, review };
        // Commit submitting before network IO: a crash never causes automatic resubmission.
        for (let i = 0; i < limit; i++) {
            const intent = await this.repo.claim();
            if (!intent)
                break;
            try {
                await this.provider.submit(intent);
                submitted++;
                await this.repo.apply(intent.reference, await this.provider.verify(intent.reference));
                verified++;
            }
            catch {
                await this.repo.uncertain(intent.id);
                review++;
            }
        }
        for (const reference of await this.repo.pending(limit)) {
            try {
                await this.repo.apply(reference, await this.provider.verify(reference));
                verified++;
            }
            catch {
                await this.repo.uncertain(reference);
                review++;
            }
        }
        return { settled, submitted, verified, review };
    }
}
