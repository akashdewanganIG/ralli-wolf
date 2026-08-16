"use client";

import React from "react";
import { MainLayout } from "@/components/main-layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useRouter } from "next/navigation";
import { ProductDetailPage } from "@/components/product-detail-page";

interface ProductDetailPageProps {
  params: Promise<{
    productId: string;
  }>;
}

export default function LeadDetailRoute({ params }: ProductDetailPageProps) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const productId = parseInt(resolvedParams.productId);

  const handleBack = () => {
    router.back();
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <ProductDetailPage
          productId={productId}
          onBack={handleBack}
          onEdit={() => {
            console.log("Lead edit initiated");
          }}
          onDelete={() => {
            console.log("Lead delete initiated");
            handleBack();
          }}
        />
      </MainLayout>
    </ProtectedRoute>
  );
}
