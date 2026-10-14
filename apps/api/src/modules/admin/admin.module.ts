import { Module } from '@nestjs/common';
import { AdminController, AdminSessionController } from './admin.controller.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AuthService } from './auth.service.js';
import { OperatorGuard } from './operator.guard.js';

@Module({
  controllers: [AdminSessionController, AdminController],
  providers: [AuthService, OperatorGuard, AdminOrdersService],
})
export class AdminModule {}
