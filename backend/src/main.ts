import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { type AppConfig } from './config/configuration';
import { DecimalToStringInterceptor } from './common/serialization/decimal-to-string.interceptor';
import { DomainExceptionFilter } from './common/exceptions/domain-exception.filter';

async function bootstrap() {
  // rawBody: true exposes req.rawBody (the exact request bytes) so the GCash
  // webhook can verify its HMAC signature before trusting the payload (audit #11).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

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

  // BE-012 — Global exception filter for consistent error responses.
  // DomainException → structured JSON; unknown → sanitized 500 (no stack leak).
  app.useGlobalFilters(new DomainExceptionFilter());

  // Graceful shutdown: enable NestJS shutdown hooks so OnModuleDestroy runs
  // (PrismaService.$disconnect()). Without this, SIGTERM/SIGINT kills the
  // process before DB connections close → leaked connections + in-flight
  // settlements can be lost. Critical for a financial app.
  app.enableShutdownHooks();

  // ── OpenAPI / Swagger ─────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kreav API')
    .setDescription(
      `
**Programmable settlement layer for digital-product creators, powered by Stellar.**

## Architecture

\`\`\`
Buyer (Philippines) → Checkout → Soroban Smart Contract → Creator Wallet (Indonesia)
                                ↓
                          95% Creator · 5% Platform
\`\`\`

## Settlement is REAL · Withdrawal is SIMULATED

| Component | Status | Details |
|-----------|--------|---------|
| Settlement | ✅ **REAL** | Soroban smart contract on Stellar Testnet. USDC moves on-chain. Verifiable via Explorer. |
| Wallet balance | ✅ **REAL** | Queried live from Stellar Horizon. |
| Withdrawal | 🔵 **SIMULATED** | Mock Anchor off-ramp. No real USDC leaves the wallet. Bank transfer is simulated. |
| Checkout payment | 🔵 **SIMULATED** | Mock GCash webhook. No real fiat moves. |

## Tags

- **Products** — Product catalog (CRUD)
- **Orders** — Checkout and payment webhook flow
- **Wallet** — USDC balance and transaction history
- **Withdrawals** — Simulated Anchor off-ramp
- **Health** — Application liveness and readiness
      `.trim(),
    )
    .setVersion('1.0.0')
    .setContact('Kreav Team', 'https://kreav.app', 'team@kreav.app')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000', 'Local development')
    .addServer('https://kreav-backend.railway.app', 'Production (Railway)')
    .addTag('Products', 'Product catalog management — create, list, and view digital products')
    .addTag('Orders', 'Checkout and payment flow — create orders and receive GCash webhooks')
    .addTag('Wallet', 'Stellar wallet — query USDC balance and settlement transaction history')
    .addTag('Withdrawals', 'Simulated Anchor off-ramp — request withdrawals and view receipts')
    .addTag('Health', 'Application health checks — liveness and PostgreSQL readiness')
    .addTag('Auth', 'User registration — email-only signup, no password (non-custodial)')
    .addTag('Analytics', 'Dashboard analytics — KPI aggregation, revenue series, top products')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    extraModels: [],
    // Ensure all response DTOs are included in the generated schema
    deepScanRoutes: true,
  });

  // Add reusable OpenAPI components for standardized error responses
  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      ErrorResponse: {
        type: 'object',
        description: 'Standard error response for all API endpoints',
        properties: {
          code: {
            type: 'string',
            description: 'Machine-readable error code',
            example: 'INSUFFICIENT_BALANCE',
          },
          message: {
            type: 'string',
            description: 'Human-readable error description',
            example:
              'Insufficient withdrawable balance. Available: 4.50 USDC, Requested: 10.00 USDC.',
          },
          statusCode: {
            type: 'integer',
            description: 'HTTP status code',
            example: 400,
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO-8601 timestamp of when the error occurred',
            example: '2026-06-30T12:00:00.000Z',
          },
        },
      },
      Pagination: {
        type: 'object',
        description: 'Pagination metadata included in list responses',
        properties: {
          page: { type: 'integer', example: 1, description: 'Current page (1-indexed)' },
          limit: { type: 'integer', example: 20, description: 'Items per page' },
          total: { type: 'integer', example: 42, description: 'Total matching records' },
        },
      },
    },
  };

  SwaggerModule.setup('api', app, document);

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Kreav backend listening on http://localhost:${port} (${nodeEnv})`);
}

void bootstrap();
