import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Orders Module — BE-005.
 * Endpoints: POST /checkout, POST /webhooks/gcash.
 *
 * EventEmitter2 is provided globally by EventEmitterModule.forRoot() in
 * AppModule, so OrdersService can inject it without a local import here.
 */
@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
