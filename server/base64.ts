/** Shared linear-time canonical base64 utilities for server input/output contracts. */
export { isValidCanonicalBase64, decodedBase64Bytes } from '../services/base64';

/**
 * Bounded raster signature sanity check before a potentially billable API call.
 * Decodes at most 64 base64 characters rather than buffering a 10 MiB upload.
 * This check is not a complete image decoder or malware/content scanner.
 */
export function matchesRasterSignature(base64: string, mimeType: string): boolean {
  // The caller must first check canonical base64 and decoded payload size.
  const bytes = Buffer.from(base64.slice(0, 64), 'base64');
  if (mimeType === 'image/png') {
    if (bytes.length < 24) return false;
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    return signature.every((n, i) => bytes[i] === n)
      && bytes.readUInt32BE(8) === 13
      && bytes.toString('ascii', 12, 16) === 'IHDR'
      && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0;
  }
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 4
      && bytes[0] === 0xff && bytes[1] === 0xd8
      && bytes[2] === 0xff && bytes[3] !== 0x00;
  }
  if (mimeType === 'image/webp') {
    if (bytes.length < 16) return false;
    const chunk = bytes.toString('ascii', 12, 16);
    return bytes.toString('ascii', 0, 4) === 'RIFF'
      && bytes.toString('ascii', 8, 12) === 'WEBP'
      && (chunk === 'VP8 ' || chunk === 'VP8L' || chunk === 'VP8X');
  }
  return false;
}
