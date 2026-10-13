import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  PlaceOrder,
  VerifyPayment,
  type OrderView,
  type PlacedOrder,
} from '@nowcore/shared';
import { OrdersService } from './orders.service.js';

const REF = /^NC-\d{5,9}$/;
function ref(r: string): string {
  if (!REF.test(r)) throw new BadRequestException('bad order reference');
  return r;
}
function parse<T>(
  schema: {
    safeParse(v: unknown):
      | { success: true; data: T }
      | {
          success: false;
          error: { issues: { path: PropertyKey[]; message: string }[] };
        };
  },
  body: unknown,
): T {
  const r = schema.safeParse(body);
  if (r.success) return r.data;
  // Field-addressed messages, so the checkout form can show each next to its input.
  throw new BadRequestException({
    message: 'Check the highlighted fields.',
    fields: Object.fromEntries(
      r.error.issues.map((i) => [i.path.join('.'), i.message]),
    ),
  });
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  place(@Body() body: unknown): Promise<PlacedOrder> {
    return this.orders.place(parse(PlaceOrder, body));
  }

  @Post(':reference/verify')
  verify(
    @Param('reference') r: string,
    @Body() body: unknown,
  ): Promise<{ status: string }> {
    return this.orders.verify(ref(r), parse(VerifyPayment, body));
  }

  @Get(':reference')
  view(
    @Param('reference') r: string,
    @Query('t') token?: string,
  ): Promise<OrderView> {
    return this.orders.view(ref(r), token);
  }
}
