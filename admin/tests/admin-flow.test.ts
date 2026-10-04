import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MOCK_PASSWORD, mockApi as api } from "../src/api/mock/index.ts";

const as = (role: "admin" | "ops" | "finance" | "support") => api.login(`${role}@vendoltd.com`, MOCK_PASSWORD);

describe("admin mock API", () => {
  it("only signs in company addresses with the right password", async () => {
    await assert.rejects(api.login("someone@gmail.com", MOCK_PASSWORD), /@vendoltd\.com/);
    await assert.rejects(api.login("ops@vendoltd.com", "wrong"), /don’t match/);
    assert.equal((await as("ops")).admin.role, "ops");
  });

  it("refuses refunds from ops, and caps finance refunds at what was paid", async () => {
    const order = (await api.listOrders()).find((o) => o.status === "delivered")!;
    await as("ops");
    await assert.rejects(api.refundOrder(order.id, 10_000, "Missing item"), /role/);
    await as("finance");
    await assert.rejects(api.refundOrder(order.id, order.totalKobo + 100, "Missing item"), /left to refund/);
    await assert.rejects(api.refundOrder(order.id, 10_000, ""), /reason/);
    const refunded = await api.refundOrder(order.id, order.totalKobo, "Missing item");
    assert.equal(refunded.refundedKobo, order.totalKobo);
    await assert.rejects(api.refundOrder(order.id, 100, "Again"), /left to refund/);
  });

  it("returns a declined withdrawal to the rider’s wallet and records it", async () => {
    await as("finance");
    const w = (await api.listWithdrawals()).find((x) => x.status === "pending")!;
    const before = (await api.listRiders()).find((r) => r.id === w.riderId)!.balanceKobo;
    await api.decideWithdrawal(w.id, "decline", "Account name mismatch");
    const after = (await api.listRiders()).find((r) => r.id === w.riderId)!.balanceKobo;
    assert.equal(after, before + w.amountKobo);
    await assert.rejects(api.decideWithdrawal(w.id, "approve", ""), /already/);
    const log = await api.listAudit();
    assert.equal(log[0].action, "Declined withdrawal");
    assert.equal(log[0].role, "finance");
  });

  it("won’t take a wallet below zero", async () => {
    await as("finance");
    const c = (await api.listCustomers())[0];
    await assert.rejects(api.adjustWallet("customer", c.id, "debit", c.walletKobo + 100, "Correction"), /below zero/);
    await api.adjustWallet("customer", c.id, "credit", 50_000, "Goodwill credit");
    assert.equal((await api.listCustomers())[0].walletKobo, c.walletKobo + 50_000);
  });

  it("lets ops review riders and suspend with a reason; support cannot", async () => {
    const pending = (await api.listRiders()).find((r) => r.approval === "pending")!;
    await as("support");
    await assert.rejects(api.reviewRider(pending.id, "approve", ""), /role/);
    await assert.rejects(api.listAudit(), /role/);
    await as("ops");
    assert.equal((await api.reviewRider(pending.id, "approve", "")).approval, "approved");
    await assert.rejects(api.setRiderSuspended(pending.id, true, ""), /reason/);
    const suspended = await api.setRiderSuspended(pending.id, true, "Repeated late deliveries");
    assert.equal(suspended.approval, "suspended");
    assert.equal(suspended.presence, "offline");
  });

  it("validates city pricing and promo codes", async () => {
    await as("ops");
    await assert.rejects(api.updateCity("kaduna", { surgeMultiplier: 5 }), /Surge/);
    await assert.rejects(api.updateCity("kaduna", { baseFareKobo: -1 }), /negative/);
    assert.equal((await api.updateCity("kaduna", { surgeOn: true })).surgeOn, true);
    await assert.rejects(api.savePromoCode({ code: "VENDO10", description: "", kind: "percent", value: 10, active: true, maxUses: 10 }), /already exists/);
    await assert.rejects(api.savePromoCode({ code: "BIG", description: "", kind: "percent", value: 10, active: true, maxUses: 10 }), /4–16/);
  });
});

describe("push notifications", () => {
  const input = { title: "Free delivery today", body: "Order before 9pm and delivery is on us.", audience: "customers" as const, cityIds: ["kaduna"], link: "food" as const };
  it("is for ops, not finance or support", async () => {
    await as("finance");
    await assert.rejects(api.sendBroadcast(input), /role/);
    await as("ops");
    const sent = await api.sendBroadcast(input);
    assert.equal(sent.status, "sent");
    assert.equal(sent.recipients, await api.countAudience("customers", ["kaduna"]));
    assert.equal((await api.listAudit())[0].action, "Sent push notification");
  });
  it("validates the message and only cancels what hasn’t gone out", async () => {
    await as("ops");
    await assert.rejects(api.sendBroadcast({ ...input, body: "Hi" }), /10–160/);
    await assert.rejects(api.sendBroadcast({ ...input, cityIds: [] }), /city/);
    await assert.rejects(api.sendBroadcast({ ...input, sendAt: new Date(Date.now() - 1000).toISOString() }), /future/);
    const later = await api.sendBroadcast({ ...input, sendAt: new Date(Date.now() + 3_600_000).toISOString() });
    assert.equal(later.status, "scheduled");
    assert.equal((await api.cancelBroadcast(later.id)).status, "cancelled");
    await assert.rejects(api.cancelBroadcast(later.id), /already/);
  });
});
