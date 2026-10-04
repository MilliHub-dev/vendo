/** Builds a CSV file from rows and downloads it. Values are quoted so commas and quotes are safe. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    // a leading = + - @ would be run as a formula by spreadsheet apps
    const safe = typeof v === "string" && /^[=+\-@]/.test(s) ? `'${s}` : s; // real numbers may be negative
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })); // BOM so Excel reads ₦ and accents
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
