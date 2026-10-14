import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * scrypt with a per-password salt — built into Node, so no dependency
 * (CLAUDE.md §2). N=2^15 costs ~50 ms per check: negligible for one operator
 * signing in, ruinous for anyone guessing offline. Format `salt:hash` in hex.
 */
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, PARAMS, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const want = Buffer.from(hash, 'hex');
  const got = await derive(password, Buffer.from(salt, 'hex'));
  return want.length === got.length && timingSafeEqual(want, got);
}
