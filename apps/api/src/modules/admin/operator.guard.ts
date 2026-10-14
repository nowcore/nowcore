import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service.js';

export function bearer(req: FastifyRequest): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
}

/**
 * Every admin route, every request: the session is resolved server-side from
 * the token. Never a client-side check (docs/05 §6).
 */
@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { operator?: unknown }>();
    const operator = await this.auth.resolve(bearer(req));
    if (!operator) throw new UnauthorizedException('Sign in again.');
    req.operator = operator;
    return true;
  }
}
