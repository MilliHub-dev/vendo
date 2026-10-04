const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // what we accept from disk before shrinking

/**
 * Checks a chosen picture and shrinks it in the browser so uploads are small and quick —
 * phone photos are often 3–8 MB. Returns a JPEG that fits inside maxWidth × maxHeight.
 */
export async function prepareImage(file: File, maxWidth: number, maxHeight: number): Promise<Blob> {
  if (!TYPES.includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP picture");
  if (file.size > MAX_BYTES) throw new Error("That picture is too large. Choose one under 10 MB");

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file couldn’t be read as a picture");
  });
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can’t process pictures");
  ctx.fillStyle = "#fff"; // transparent PNGs get a white background in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("That picture couldn’t be processed"))), "image/jpeg", 0.85));
}

/** Longest sides we keep for each kind of picture. */
export const imageSizes = { logo: [512, 512], banner: [1600, 800], menu_item: [900, 900] } as const;
