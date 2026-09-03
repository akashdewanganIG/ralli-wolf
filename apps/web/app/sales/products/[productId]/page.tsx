"use client";

import React from "react";
import { MainLayout } from "@/components/main-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { useRouter } from "next/navigation";
import { ProductDetailPage } from "@/components/product-detail-page";

interface ProductDetailPageProps {
  params: Promise<{
    productId: string;
  }>;
}

export default function ProductDetailRoute({ params }: ProductDetailPageProps) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const productId = parseInt(resolvedParams.productId);

  const handleBack = () => {
    router.back();
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <ProductDetailPage productId={productId} onBack={handleBack} />
      </MainLayout>
    </ProtectedRoute>
  );
}
