import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toCsv } from "../src/lib/csv.ts";
import { can, orderGroup } from "../src/lib/permissions.ts";

describe("permissions", () => {
  it("keeps money actions with finance and the super admin", () => {
    for (const p of ["orders.refund", "wallet.adjust", "withdrawals.decide"] as const) {
      assert.equal(can("finance", p), true);
      assert.equal(can("super_admin", p), true);
      assert.equal(can("ops", p), false);
      assert.equal(can("support", p), false);
    }
  });
  it("lets support manage orders but nothing else", () => {
    assert.equal(can("support", "orders.manage"), true);
    assert.equal(can("support", "riders.review"), false);
    assert.equal(can("support", "audit.view"), false);
    assert.equal(can(undefined, "orders.manage"), false);
  });
  it("groups order statuses into the five feed filters", () => {
    assert.equal(orderGroup("searching_rider"), "pending");
    assert.equal(orderGroup("on_the_way"), "active");
    assert.equal(orderGroup("delivered"), "completed");
    assert.equal(orderGroup("disputed"), "disputed");
  });
});

describe("csv", () => {
  it("quotes commas and quotes, and defuses spreadsheet formulas", () => {
    const lines = toCsv(["Name", "Note"], [["Bola, A", 'said "hi"'], ["=SUM(A1)", -5]]).split("\r\n");
    assert.equal(lines[0], '"Name","Note"');
    assert.equal(lines[1], '"Bola, A","said ""hi"""');
    assert.equal(lines[2], '"\'=SUM(A1)","-5"');
  });
});
