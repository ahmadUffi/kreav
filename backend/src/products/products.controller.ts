import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiQuery,
  ApiParam,
  ApiCreatedResponse,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationDto } from './dto/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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
@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all products',
    description:
      'Returns a paginated list of products. Optionally filter by creatorId. ' +
      'Includes creator info and fileUrl (download link). Ordered newest-first.',
  })
  @ApiQuery({
    name: 'creatorId',
    description: 'Filter by creator user ID (UUID)',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-indexed)',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page',
    required: false,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of products',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', description: 'Array of product objects' },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        total: { type: 'integer', example: 8 },
      },
    },
  })
  findAll(@Query() query: PaginationDto) {
    return this.products.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get product by ID',
    description:
      'Returns a single product with creator details and fileUrl (download link). ' +
      'Throws 404 if the product is not found.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Creates a new digital product owned by the authenticated creator ' +
      '(identity from the session JWT). ' +
      '`priceUsd` must be a decimal string with 0-2 fractional digits. ' +
      '`fileUrl` is the download or access link for the digital product.',
  })
  @ApiBody({
    type: CreateProductDto,
    description: 'Product creation payload',
    examples: {
      preset: {
        summary: '🌅 Lightroom Presets',
        value: {
          title: 'Lightroom Sunset Presets',
          description: '12 warm, film-inspired Lightroom presets.',
          fileUrl: 'https://drive.google.com/file/d/abc002/view',
          priceUsd: '18.00',
        },
      },
      ebook: {
        summary: '📘 Freelance Pricing Ebook',
        value: {
          title: 'Freelance Pricing Ebook',
          description: 'A no-fluff guide to pricing your freelance work.',
          fileUrl: 'https://drive.google.com/file/d/abc005/view',
          priceUsd: '9.00',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.products.create(dto, user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a product (owner only)',
    description:
      'Patches the given fields. If `collaborators` is provided, the revenue-split ' +
      'set is replaced wholesale (same validation as create). 404 if the product is ' +
      'not found or not owned by the caller.',
  })
  @ApiParam({ name: 'id', description: 'Product ID (UUID)' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Product not found / not owned' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto, user.userId);
  }

  @Patch(':id/archive')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Archive a product (owner only)',
    description: 'Soft-deletes: hides the product from the storefront but keeps order history.',
  })
  @ApiParam({ name: 'id', description: 'Product ID (UUID)' })
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.setStatus(id, user.userId, ProductStatus.ARCHIVED);
  }

  @Patch(':id/restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore an archived product (owner only)' })
  @ApiParam({ name: 'id', description: 'Product ID (UUID)' })
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.setStatus(id, user.userId, ProductStatus.ACTIVE);
  }
}
