"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { entityImageService } from "../lib/api/supply-chain-services";

export const entityImageKeys = {
  productImages: (productId: number) =>
    ["entity-images", "products", productId] as const,
  receiptImages: (grnId: number) =>
    ["entity-images", "goods-receipts", grnId] as const,
  qualityCheckImages: (qualityCheckId: number) =>
    ["entity-images", "quality-checks", qualityCheckId] as const,
};

export function useProductImages(productId: number, enabled = true) {
  const queryClient = useQueryClient();
  const key = entityImageKeys.productImages(productId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  return {
    query: useQuery({
      queryKey: key,
      queryFn: () => entityImageService.listProductImages(productId),
      enabled: enabled && Number.isFinite(productId) && productId > 0,
    }),
    addImages: useMutation({
      meta: { successMessage: "Product images uploaded" },
      mutationFn: (images: File[]) =>
        entityImageService.addProductImages(productId, images),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["products"] });
      },
    }),
    deleteImage: useMutation({
      meta: { successMessage: "Product image removed" },
      mutationFn: (imageId: number) =>
        entityImageService.deleteProductImage(imageId),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["products"] });
      },
    }),
  };
}

export function useSupplierLogo(supplierId: number) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["supply-chain", "suppliers"],
    });

  return {
    upload: useMutation({
      meta: { successMessage: "Supplier logo updated" },
      mutationFn: (logo: File) =>
        entityImageService.uploadSupplierLogo(supplierId, logo),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      meta: { successMessage: "Supplier logo removed" },
      mutationFn: () => entityImageService.deleteSupplierLogo(supplierId),
      onSuccess: invalidate,
    }),
  };
}

export function useReceiptImages(grnId: number, enabled = true) {
  const queryClient = useQueryClient();
  const key = entityImageKeys.receiptImages(grnId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  return {
    query: useQuery({
      queryKey: key,
      queryFn: () => entityImageService.listReceiptImages(grnId),
      enabled: enabled && Number.isFinite(grnId) && grnId > 0,
    }),
    addImages: useMutation({
      meta: { successMessage: "Receipt photos uploaded" },
      mutationFn: ({
        images,
        grnLineId,
        caption,
      }: {
        images: File[];
        grnLineId?: number;
        caption?: string;
      }) =>
        entityImageService.addReceiptImages(grnId, images, {
          grnLineId,
          caption,
        }),
      onSuccess: invalidate,
    }),
    deleteImage: useMutation({
      meta: { successMessage: "Receipt photo removed" },
      mutationFn: (imageId: number) =>
        entityImageService.deleteReceiptImage(imageId),
      onSuccess: invalidate,
    }),
  };
}

export function useQualityCheckImages(qualityCheckId: number, enabled = true) {
  const queryClient = useQueryClient();
  const key = entityImageKeys.qualityCheckImages(qualityCheckId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  return {
    query: useQuery({
      queryKey: key,
      queryFn: () => entityImageService.listQualityCheckImages(qualityCheckId),
      enabled:
        enabled && Number.isFinite(qualityCheckId) && qualityCheckId > 0,
    }),
    addImages: useMutation({
      meta: { successMessage: "Inspection photos uploaded" },
      mutationFn: ({
        images,
        caption,
      }: {
        images: File[];
        caption?: string;
      }) =>
        entityImageService.addQualityCheckImages(
          qualityCheckId,
          images,
          caption
        ),
      onSuccess: invalidate,
    }),
    deleteImage: useMutation({
      meta: { successMessage: "Inspection photo removed" },
      mutationFn: (imageId: number) =>
        entityImageService.deleteQualityCheckImage(imageId),
      onSuccess: invalidate,
    }),
  };
}
