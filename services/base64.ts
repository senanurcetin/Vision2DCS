/**
 * Linear-time, constant-stack verification for external inline image data.
 * Rejects whitespace, URL-safe alphabet, misplaced padding and partial groups.
 * Never use a nested repeated-group RegExp on multi-megabyte base64 input.
 */
export function isValidCanonicalBase64(value: string): boolean {
  const length = value.length;
  if (length === 0 || length % 4 !== 0) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const bodyLength = length - padding;
  for (let i = 0; i < bodyLength; i++) {
    const c = value.charCodeAt(i);
    const valid =
      (c >= 65 && c <= 90) ||  // A-Z
      (c >= 97 && c <= 122) || // a-z
      (c >= 48 && c <= 57) ||  // 0-9
      c === 43 || c === 47;    // +/
    if (!valid) return false;
  }
  for (let i = bodyLength; i < length; i++) {
    if (value.charCodeAt(i) !== 61) return false; // =
  }
  return true;
}

export function decodedBase64Bytes(value: string): number {
  const length = value.length;
  return Math.floor(length * 3 / 4) - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0);
}
