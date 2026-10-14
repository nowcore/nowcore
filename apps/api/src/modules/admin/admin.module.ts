import { Module } from '@nestjs/common';
import { AdminController, AdminSessionController } from './admin.controller.js';
import { AdminDropsController } from './admin-drops.controller.js';
import { AdminDropsService } from './admin-drops.service.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminRumService } from './admin-rum.service.js';
import { AdminTrendsService } from './admin-trends.service.js';
import { DropClockService } from './drop-clock.service.js';
import { AuthService } from './auth.service.js';
import { OperatorGuard } from './operator.guard.js';

@Module({
  controllers: [AdminSessionController, AdminController, AdminDropsController],
  providers: [
    AuthService,
    OperatorGuard,
    AdminOrdersService,
    AdminDropsService,
    DropClockService,
    AdminTrendsService,
    AdminRumService,
  ],
})
export class AdminModule {}
