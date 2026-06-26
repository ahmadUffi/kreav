import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { type AppConfig } from './config/configuration';
import { DecimalToStringInterceptor } from './common/serialization/decimal-to-string.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Security: secure HTTP headers (Helmet) + CORS for the cross-origin
  // frontend (Next.js on Vercel → backend on Railway). Without these the
  // browser blocks every request during the demo.
  app.use(helmet());
  app.enableCors();

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

  // Audit #10 — serialize every Prisma.Decimal in responses to a string.
  // Without this, money fields (`priceUsd`, `amountUsd`, ...) JSON-serialize to
  // Prisma's internal `{ d: [...], e, s }` structure instead of "10.00".
  app.useGlobalInterceptors(new DecimalToStringInterceptor());

  // Graceful shutdown: enable NestJS shutdown hooks so OnModuleDestroy runs
  // (PrismaService.$disconnect()). Without this, SIGTERM/SIGINT kills the
  // process before DB connections close → leaked connections + in-flight
  // settlements can be lost. Critical for a financial app.
  app.enableShutdownHooks();

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Kreav backend listening on http://localhost:${port} (${nodeEnv})`);
}

void bootstrap();
