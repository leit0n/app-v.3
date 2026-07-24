// Shared UUID helper. Never call crypto.randomUUID() directly elsewhere —
// some browsers (non-secure contexts, older WebViews) don't expose it.
export function safeUUID() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  // Fallback UUIDv4-ish (not cryptographically strong)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
