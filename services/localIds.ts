/**
 * New local engineering objects must not collide under rapid creation,
 * duplicate timestamps, React rerenders, or simultaneous backup imports.
 * Cryptographic randomness keeps IDs distinct across tabs; the in-tab
 * monotonic counter remains a fallback for restricted test environments.
 * No user data or secrets are included in the generated ID.
 */
let sequence = 0;

export const createLocalId = (kind: 'proj' | 'demo' | 'manual'): string => {
  sequence++;
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return kind + '-' + uuid + '-' + sequence.toString(36);
  const entropy = new Uint8Array(12);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(entropy);
  } else {
    // Nonsecurity fallback: uniqueness within this tab comes from sequence.
    for (let i = 0; i < entropy.length; i++) entropy[i] = Math.floor(Math.random() * 256);
  }
  const random = Array.from(entropy, n => n.toString(16).padStart(2, '0')).join('');
  return kind + '-' + Date.now().toString(36) + '-' + sequence.toString(36) + '-' + random;
};
