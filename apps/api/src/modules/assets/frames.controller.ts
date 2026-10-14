import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { normalize, join, sep } from 'node:path';
import { ENV, type Env } from '../../env.js';

const TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  png: 'image/png',
};

/**
 * Rendered turntables, served until Supabase Storage takes over (T-035).
 *
 * Frames used to live in the web app's public/, and Next serves only what
 * existed at build time: a drop rendered after a deploy 404'd until the next
 * deploy (found 14 Oct 2026). Serving them from here decouples rendering from
 * deploying, which is the whole point of the one-day drop.
 *
 * Every re-render writes to a new revision path, so a frame never changes at
 * its URL — hence `immutable`. Paths are confined to FRAMES_DIR.
 */
@Controller('frames')
export class FramesController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get('*')
  async frame(
    @Param('*') path: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const ext = path.split('.').pop() ?? '';
    const type = TYPES[ext];
    const root = normalize(this.env.FRAMES_DIR + sep);
    const file = normalize(join(root, path));
    if (!type || !file.startsWith(root) || path.includes('\0'))
      throw new NotFoundException();
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException();
    await reply
      .header('content-type', type)
      .header('content-length', String(info.size))
      .header('cache-control', 'public, max-age=31536000, immutable')
      // Public assets, fetched by the storefront's canvas from another origin.
      .header('access-control-allow-origin', '*')
      // Without this the browser reports every cross-origin frame as 0 bytes
      // to Resource Timing — motion-check went blind to the frame budget the
      // moment frames moved here, and field RUM (T-094) would too.
      .header('timing-allow-origin', '*')
      .send(createReadStream(file));
  }
}
