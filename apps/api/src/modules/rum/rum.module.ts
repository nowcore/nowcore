import { Module } from '@nestjs/common';
import { RumController } from './rum.controller.js';

@Module({ controllers: [RumController] })
export class RumModule {}
