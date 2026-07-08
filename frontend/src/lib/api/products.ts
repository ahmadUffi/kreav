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
