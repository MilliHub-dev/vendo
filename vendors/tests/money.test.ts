import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatNaira, nairaToKobo } from "../src/lib/money.ts";

describe("money", () => {
  it("formats whole naira with thousands separators", () => {
    assert.equal(formatNaira(0), "₦0");
    assert.equal(formatNaira(150_000), "₦1,500");
    assert.equal(formatNaira(139_900_000), "₦1,399,000");
  });
  it("shows kobo only when there are some, and handles negatives", () => {
    assert.equal(formatNaira(150_050), "₦1,500.50");
    assert.equal(formatNaira(-20_000), "-₦200");
  });
  it("converts naira to kobo without floating-point drift", () => {
    assert.equal(nairaToKobo(19.99), 1999);
    assert.equal(nairaToKobo(0.1 + 0.2), 30);
  });
});
