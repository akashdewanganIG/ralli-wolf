"use client";

import React from "react";
import { Card, CardContent } from "@repo/ui";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useKeyMetrics } from "../hooks/useDashboard";
import { StatGridSkeleton } from "./skeletons";

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative";
}

interface MetricData {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative";
}

function MetricCard({ title, value, change, changeType }: MetricCardProps) {
  const isPositive = changeType === "positive";
  return (
    <Card className="h-full transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md">
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-bold text-primary uppercase tracking-wide">
            {title}
          </p>
          <div className={isPositive ? "text-green-600" : "text-red-600"}>
            {isPositive ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-between">
          <div className="text-3xl font-bold tracking-tight text-foreground">
            {value}
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-bold ${isPositive ? "text-green-600" : "text-red-600"}`}
              >
                {change} from last month
              </span>
              <span className="text-xs text-muted-foreground">
                vs last month
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Updated just now</p>
            <p className="text-xs italic text-muted-foreground">
              Updates daily at 2 AM IST
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KeyMetrics() {
  const { data: metrics, isLoading, error } = useKeyMetrics();

  if (isLoading) {
    return <StatGridSkeleton count={6} />;
  }

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="h-full col-span-full">
          <CardContent className="p-4 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-medium text-red-600">
                Error loading metrics
              </div>
              <div className="text-sm text-gray-500">
                Please try again later
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {metrics?.map((metric: MetricData, index: number) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          change={metric.change}
          changeType={metric.changeType}
        />
      ))}
    </div>
  );
}
