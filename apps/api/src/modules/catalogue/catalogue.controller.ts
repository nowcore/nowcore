import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
} from '@nestjs/common';
import type { DropSummary, DropView, ProductPage } from '@nowcore/shared';
import { CatalogueService } from './catalogue.service.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slug = (s: string) => {
  if (!SLUG.test(s) || s.length > 80) throw new BadRequestException('bad slug');
  return s;
};

/**
 * Public catalogue. Short shared caching: a drop page is read by everyone at
 * once when it opens, and 30 seconds of staleness on stock is acceptable
 * because availability is re-checked when the order is placed (T-051).
 */
@Controller()
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('drops/live')
  @Header('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
  live(): Promise<DropView> {
    return this.catalogue.liveDrop();
  }

  @Get('drops/archive')
  @Header('Cache-Control', 'public, s-maxage=300')
  archive(): Promise<DropSummary[]> {
    return this.catalogue.archive();
  }

  @Get('drops/:slug')
  @Header('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
  drop(@Param('slug') s: string): Promise<DropView> {
    return this.catalogue.drop(slug(s));
  }

  @Get('products/:slug')
  @Header('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
  product(@Param('slug') s: string): Promise<ProductPage> {
    return this.catalogue.product(slug(s));
  }
}
