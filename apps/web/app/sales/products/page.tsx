"use client";

import { RoleGuard } from "@/components/guards/role-guard";
import { ProductManagement } from "@/components/product-management";

export default function ProductsPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN", "SALES"]}>
      <ProductManagement />
    </RoleGuard>
  );
}
