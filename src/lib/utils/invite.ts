/** Normalizes a user-typed invite code: trim, uppercase, remove non-alphanumeric. */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Client-side fallback invite code generator (Postgres generates codes by default). */
export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  // Use Array.from to avoid Uint8Array spread issues
  const binary = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('')
  return btoa(binary)
    .replace(/[+/=]/g, '')
    .toUpperCase()
    .slice(0, 8)
}
