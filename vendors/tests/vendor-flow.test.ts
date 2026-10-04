/**
 * Exercises the mock backend the dashboard runs on. It works on real timers (reviews
 * complete, orders arrive every ~25 s), so these tests take about a minute.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { defaultHours, MOCK_SMS_CODE, mockApi } from "../src/api/mock/index.ts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nextNewOrder() {
  for (let i = 0; i < 70; i++) {
    const order = (await mockApi.listOrders()).find((o) => o.status === "new");
    if (order) return order;
    await wait(500);
  }
  throw new Error("no order arrived");
}

describe("store registration", () => {
  it("goes sign-up → store details → review → approved, and can’t open before approval or with an empty menu", async () => {
    await mockApi.requestCode("+2348039990000");
    await assert.rejects(mockApi.verifyCode("+2348039990000", "000000"), /not correct/);
    assert.equal((await mockApi.verifyCode("+2348039990000", MOCK_SMS_CODE)).user, null); // new number → sign-up
    await mockApi.completeSignUp({ name: "Test Owner", email: "owner@example.com" });
    assert.equal(await mockApi.getStore(), null);

    const details = { name: "Test Kitchen", category: "restaurant" as const, cuisine: "Rice dishes", description: "", cityId: "kaduna", address: "Kawo Road, Kaduna", hours: defaultHours() };
    await assert.rejects(mockApi.registerStore({ ...details, name: " " }), /store name/);
    assert.equal((await mockApi.registerStore(details)).approval, "under_review");
    await assert.rejects(mockApi.setOpen(true), /approved/);

    await wait(9_500); // the mock reviewer approves
    assert.equal((await mockApi.getStore())?.approval, "approved");
    await assert.rejects(mockApi.setOpen(true), /menu item/);

    const item = { name: " Jollof Rice ", description: "", priceKobo: 250_000, category: "Rice", isAvailable: true, emoji: "🍛" };
    await assert.rejects(mockApi.saveMenuItem({ ...item, priceKobo: 100 }), /at least ₦50/);
    assert.equal((await mockApi.saveMenuItem(item)).name, "Jollof Rice");
    assert.equal((await mockApi.setOpen(true)).isOpen, true);
    await mockApi.setOpen(false);
  });
});

describe("running the demo store", () => {
  before(async () => {
    await mockApi.requestCode("+2348032222222");
    await mockApi.verifyCode("+2348032222222", MOCK_SMS_CODE);
  });

  it("receives no orders while closed", async () => {
    await wait(1500);
    assert.equal((await mockApi.listOrders()).some((o) => o.status === "new"), false);
  });

  it("pays the store the subtotal less commission", async () => {
    await mockApi.setOpen(true);
    const order = await nextNewOrder();
    const subtotal = order.items.reduce((n, i) => n + i.unitPriceKobo * i.quantity, 0);
    assert.equal(order.subtotalKobo, subtotal);
    assert.equal(order.commissionKobo, Math.round(subtotal * 0.15));
    assert.equal(order.payoutKobo, subtotal - order.commissionKobo);
    assert.ok(order.respondBy);
  });

  it("moves an order new → preparing → ready, in that order only", async () => {
    const order = await nextNewOrder();
    await assert.rejects(mockApi.markReady(order.id), /being prepared/); // can't skip accepting

    const accepted = await mockApi.acceptOrder(order.id, 20);
    assert.equal(accepted.status, "preparing");
    assert.equal(accepted.prepMinutes, 20);
    await assert.rejects(mockApi.acceptOrder(order.id, 20), /already been answered/);
    await assert.rejects(mockApi.rejectOrder(order.id, "Too busy"), /already been answered/);

    const ready = await mockApi.markReady(order.id);
    assert.equal(ready.status, "ready");
    assert.ok(ready.rider);

    const today = (await mockApi.getDashboard()).today;
    assert.equal(today.orders, 1);
    assert.equal(today.payoutKobo, accepted.payoutKobo);
  });

  it("records a rejection with its reason and doesn’t count it as a sale", async () => {
    const before = (await mockApi.getDashboard()).today.orders;
    const order = await nextNewOrder();
    const rejected = await mockApi.rejectOrder(order.id, "An item is out of stock");
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectReason, "An item is out of stock");
    assert.equal((await mockApi.getDashboard()).today.orders, before);
  });

  it("validates the payout bank account", async () => {
    await assert.rejects(mockApi.saveBankAccount({ bankCode: "058", accountNumber: "123", accountName: "Arewa Kitchen" }), /10 digits/);
    const payouts = await mockApi.saveBankAccount({ bankCode: "044", accountNumber: "0011223344", accountName: "Arewa Kitchen Ltd" });
    assert.equal(payouts.account?.bankName, "Access Bank");
    assert.equal(payouts.account?.accountNumber, "0011223344");
  });
});

describe("pictures", () => {
  const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });

  it("accepts JPEG, PNG and WebP up to 5 MB and returns a URL", async () => {
    const url = await mockApi.uploadImage(png, "logo");
    assert.match(url, /^data:image\/png;base64,/);
    await assert.rejects(mockApi.uploadImage(new Blob(["x"], { type: "application/pdf" }), "logo"), /JPEG, PNG or WebP/);
    await assert.rejects(mockApi.uploadImage(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/jpeg" }), "banner"), /up to 5 MB/);
  });

  it("saves a logo and banner on the store, and removes one with null", async () => {
    const url = await mockApi.uploadImage(png, "logo");
    let store = await mockApi.updateStore({ logoUrl: url, bannerUrl: url });
    assert.equal(store.logoUrl, url);
    assert.equal(store.bannerUrl, url);

    store = await mockApi.updateStore({ name: "Arewa Kitchen" }); // other edits leave the pictures alone
    assert.equal(store.logoUrl, url);

    store = await mockApi.updateStore({ logoUrl: null });
    assert.equal(store.logoUrl, undefined);
    assert.equal(store.bannerUrl, url);
  });

  it("saves a photo on a menu item and can remove it", async () => {
    const url = await mockApi.uploadImage(png, "menu_item");
    const [first] = await mockApi.listMenu();
    const { id, ...fields } = first;
    assert.equal((await mockApi.saveMenuItem({ ...fields, imageUrl: url }, id)).imageUrl, url);
    assert.equal((await mockApi.saveMenuItem({ ...fields, imageUrl: undefined }, id)).imageUrl, undefined);
  });
});
