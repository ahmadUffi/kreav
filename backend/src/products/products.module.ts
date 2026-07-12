import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';

/**
 * Product Module — PRD §6, §9.
 * Endpoints: GET /products, GET /products/:id, POST /products.
 * StellarModule provides HorizonService for collaborator trustline checks.
 */
@Module({
  imports: [PrismaModule, StellarModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
