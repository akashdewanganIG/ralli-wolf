import { MainLayout } from "@/components/main-layout";
import {
  AnalyticsDashboard,
  AnalyticsDashboardSkeleton,
} from "@/components/analytics-dashboard";
import { ProtectedRoute } from "@/components/protected-route";

export default function Home() {
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
