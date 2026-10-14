import { Module } from '@nestjs/common';
import { FramesController } from './frames.controller.js';

@Module({ controllers: [FramesController] })
export class AssetsModule {}
