import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PaginationDto } from './dto/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';

/**
 * ProductsController — public product catalog endpoints.
 *
 * Source: Kreav Backend PRD v3 — §9 Product APIs.
 *   GET /products         → paginated list (optional ?creatorId=)
 *   GET /products/:id     → product detail + creator
 *   POST /products        → create product
 *
 * Money in responses is serialized to string by the global
 * DecimalToStringInterceptor — controllers stay Decimal-agnostic.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.products.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }
}
