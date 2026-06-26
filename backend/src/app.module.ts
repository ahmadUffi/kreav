import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration, validationSchema } from './config';
import { HealthModule } from './common/health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';

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
    PrismaModule,
    HealthModule,
    ProductsModule,
  ],
})
export class AppModule {}
