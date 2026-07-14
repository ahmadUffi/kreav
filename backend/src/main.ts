import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { type AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService<AppConfig, true>);
  const port = configService.get('PORT', { infer: true }) ?? 3000;
  const nodeEnv = configService.get('NODE_ENV', { infer: true });

  // Global validation pipe — fail fast on invalid request payloads.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Kreav backend listening on http://localhost:${port} (${nodeEnv})`);
}

void bootstrap();
