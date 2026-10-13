import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { SetItem, type CartView } from '@nowcore/shared';
import { CartService } from './cart.service.js';

@Controller('carts')
export class CartController {
  constructor(private readonly carts: CartService) {}

  @Post()
  create(): Promise<CartView> {
    return this.carts.create();
  }

  @Get(':id')
  view(@Param('id', new ParseUUIDPipe()) id: string): Promise<CartView> {
    return this.carts.view(id);
  }

  @Put(':id/items')
  setItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<CartView> {
    const parsed = SetItem.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    return this.carts.setItem(id, parsed.data);
  }
}
