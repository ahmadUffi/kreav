import { IsUUID } from 'class-validator';

/**
 * Body for POST /checkout. Source: Kreav Backend PRD v3 — §9 + BE-005.
 */
export class CheckoutDto {
  @IsUUID()
  productId!: string;
}
