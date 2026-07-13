import { api } from "./client";
import { mapProduct } from "./mappers";
import type { Paginated, ProductRaw, CreateProductBody } from "./types";
import type { Product } from "@/lib/types";

export interface ProductList {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export async function listProducts(
  params: { creatorId?: string; page?: number; limit?: number } = {},
): Promise<ProductList> {
  const res = await api.get<Paginated<ProductRaw>>("/products", params);
  return { items: res.data.map(mapProduct), total: res.total, page: res.page, limit: res.limit };
}

export async function getProduct(id: string): Promise<Product> {
  return mapProduct(await api.get<ProductRaw>(`/products/${id}`));
}

export async function createProduct(body: CreateProductBody): Promise<Product> {
  return mapProduct(await api.post<ProductRaw>("/products", body));
}

/** Update a product (owner only). Send only changed fields; collaborators replace the split. */
export async function updateProduct(id: string, body: Partial<CreateProductBody>): Promise<Product> {
  return mapProduct(await api.patch<ProductRaw>(`/products/${id}`, body));
}

/** Archive (soft-delete) a product — hides it from the storefront. */
export async function archiveProduct(id: string): Promise<Product> {
  return mapProduct(await api.patch<ProductRaw>(`/products/${id}/archive`, {}));
}

/** Restore an archived product. */
export async function restoreProduct(id: string): Promise<Product> {
  return mapProduct(await api.patch<ProductRaw>(`/products/${id}/restore`, {}));
}
