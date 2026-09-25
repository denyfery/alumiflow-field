import { apiRequest } from '@/api/client';
import type { ProductSnapshotResponse } from '@/types/api';

export async function productSnapshotRequest(): Promise<ProductSnapshotResponse> {
  return apiRequest<ProductSnapshotResponse>('/products');
}
