import { MainLayout } from "@/components/main-layout";
import {
  AnalyticsDashboard,
  AnalyticsDashboardSkeleton,
} from "@/components/analytics-dashboard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
// import { redirect } from "next/navigation";

export default function Home() {
  // redirect('/sales/orders');
  const fallback = (
    <MainLayout>
      <AnalyticsDashboardSkeleton />
    </MainLayout>
  );

  return (
    <ProtectedRoute fallback={fallback}>
      <MainLayout>
        <AnalyticsDashboard />
      </MainLayout>
    </ProtectedRoute>
  );
}
