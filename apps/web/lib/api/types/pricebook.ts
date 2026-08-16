export interface PriceBook {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPriceBooksResponse {
  data: PriceBook[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
