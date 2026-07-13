import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/**
 * Body for PATCH /products/:id — every field optional.
 *
 * When `collaborators` is provided, the product's collaborator set is REPLACED
 * wholesale (same validation as create: valid Stellar addresses, registered +
 * USDC-trustlined, shares sum to 100.00). Omit it to leave collaborators as-is.
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
