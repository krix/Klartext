/** PIN wird nur als gesalzener SHA-256-Hash lokal gespeichert (kein Klartext). */

export function newSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(pin: string, salt: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Die PIN-Funktion braucht HTTPS oder localhost als sicheren Kontext.');
  }
  const data = new TextEncoder().encode(`klartext:${salt}:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hashPin(pin: string, salt: string): Promise<string> {
  return digest(pin, salt);
}

export async function verifyPin(pin: string, salt: string | null, expectedHash: string | null): Promise<boolean> {
  if (!salt || !expectedHash) return false;
  const actual = await digest(pin, salt);
  if (actual.length !== expectedHash.length) return false;
  // Vergleich in konstanter Zeit, damit die PIN nicht erraten werden kann.
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}
