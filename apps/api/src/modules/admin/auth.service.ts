import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Operator } from '@nowcore/db';
import { PrismaService } from '../../prisma.service.js';
import { verifyPassword } from './password.js';

const SESSION_HOURS = 12;
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Operator sign-in (T-063, ADR-005). A session token is 32 random bytes; the
 * database holds only its SHA-256, so a leaked table cannot be replayed. One
 * error message for a wrong email and a wrong password, so the form does not
 * say which operators exist.
 */
@Injectable()
export class AuthService {
  /** Failed attempts per email. In memory: a restart forgets them, which only ever helps a legitimate operator. */
  private readonly failures = new Map<string, number[]>();

  constructor(private readonly db: PrismaService) {}

  async login(
    email: string,
    password: string,
  ): Promise<{
    token: string;
    expiresAt: Date;
    operator: Pick<Operator, 'email' | 'name'>;
  }> {
    const key = email.trim().toLowerCase();
    const now = Date.now();
    const recent = (this.failures.get(key) ?? []).filter(
      (t) => now - t < WINDOW_MS,
    );
    if (recent.length >= MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many attempts. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const operator = await this.db.operator.findUnique({
      where: { email: key },
    });
    // Verify even when the operator does not exist, so a missing account and
    // a wrong password take the same time.
    const ok = await verifyPassword(
      password,
      operator?.passwordHash ?? '00:00',
    );
    if (!operator || !ok) {
      this.failures.set(key, [...recent, now]);
      throw new UnauthorizedException('Email or password is wrong.');
    }
    this.failures.delete(key);

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now + SESSION_HOURS * 3_600_000);
    await this.db.operatorSession.create({
      data: { operatorId: operator.id, tokenHash: sha256(token), expiresAt },
    });
    return {
      token,
      expiresAt,
      operator: { email: operator.email, name: operator.name },
    };
  }

  async resolve(token: string | undefined): Promise<Operator | null> {
    if (!token) return null;
    const session = await this.db.operatorSession.findUnique({
      where: { tokenHash: sha256(token) },
      include: { operator: true },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return session.operator;
  }

  async logout(token: string | undefined): Promise<void> {
    if (token)
      await this.db.operatorSession.deleteMany({
        where: { tokenHash: sha256(token) },
      });
  }
}
