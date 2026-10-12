import { Logger } from '@nestjs/common';
import { createApp } from './create-app.js';
import { ENV, type Env } from './env.js';

const app = await createApp();
const env = app.get<Env>(ENV);
await app.listen({ port: env.PORT, host: env.HOST });
new Logger('bootstrap').log(`api listening on ${env.HOST}:${env.PORT}`);
