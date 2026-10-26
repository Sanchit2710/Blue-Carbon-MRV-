import { createHash } from "node:crypto";
import sharp from "sharp";

export const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

// 64-bit difference hash (hex). Similarity screen only — NOT proof of reuse or fraud.
export async function dHash(buf: Buffer): Promise<string> {
  const px = await sharp(buf).rotate().grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? "1" : "0";
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

export function hamming(a: string, b: string) {
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    let v = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    for (; v; v >>= 1) n += v & 1;
  }
  return n;
}
