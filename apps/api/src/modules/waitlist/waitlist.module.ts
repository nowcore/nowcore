import { Module } from '@nestjs/common';
import { WaitlistController } from './waitlist.controller.js';

@Module({ controllers: [WaitlistController] })
export class WaitlistModule {}
