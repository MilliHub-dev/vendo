import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toCsv } from "../src/lib/csv.ts";
describe("csv", () => {
  it("quotes commas and quotes, and defuses spreadsheet formulas", () => {
    const lines = toCsv(["Name", "Note"], [["Bola, A", 'said "hi"'], ["=SUM(A1)", -5]]).split("\r\n");
    assert.equal(lines[0], '"Name","Note"');
    assert.equal(lines[1], '"Bola, A","said ""hi"""');
    assert.equal(lines[2], '"\'=SUM(A1)","-5"');
  });
});
