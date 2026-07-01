import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { configuration, validationSchema } from './config';
import { HealthModule } from './common/health/health.module';
import { StartupModule } from './common/startup/startup.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { EventsModule } from './events/events.module';
import { OrdersModule } from './orders/orders.module';
import { StellarModule } from './stellar/stellar.module';
import { WalletsModule } from './wallets/wallets.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UsersModule } from './users/users.module';
import { SiteModule } from './site/site.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        // Fail fast if a required/invalid env var is present.
        abortEarly: false,
      },
    }),

    // BE-006 — in-process event bus for payment.received / settlement.completed.
    EventEmitterModule.forRoot(),

    // Audit #7 — global rate limiting. Defaults: 100 req / 60s per IP.
    // Override per-route with @Throttle() (e.g. tighter on webhooks).
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),

    PrismaModule,
    HealthModule,
    EventsModule,
    ProductsModule,
    OrdersModule,
    StellarModule,
    WalletsModule,
    StartupModule,
    WithdrawalsModule,
    AuthModule,
    AnalyticsModule,
    UsersModule,
    SiteModule,
  ],
  providers: [
    // Activate the global throttle guard so @Throttle() / defaults apply.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
