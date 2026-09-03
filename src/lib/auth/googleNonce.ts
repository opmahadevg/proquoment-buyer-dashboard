/**
 * Cryptographic nonce generator for Google One Tap & Supabase Auth.
 * Supabase expects the provider (Google) to hash the nonce with SHA-256,
 * while signInWithIdToken requires the unhashed raw nonce to verify against the token claim.
 */
export async function generateGoogleNonce(): Promise<{ nonce: string; hashedNonce: string }> {
  // Generate random 32-byte entropy
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    const fallback = Math.random().toString(36).substring(2) + Date.now().toString(36);
    return { nonce: fallback, hashedNonce: fallback };
  }

  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  const rawNonce = btoa(String.fromCharCode(...array));

  const encoder = new TextEncoder();
  const encodedNonce = encoder.encode(rawNonce);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encodedNonce);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return { nonce: rawNonce, hashedNonce };
}
