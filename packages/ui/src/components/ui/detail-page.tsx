import * as React from "react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Progress } from "./progress";
import { ArrowLeft } from "@repo/ui/icons";
import { Tag, type TagTone } from "@repo/ui/components/ui/tag";

interface DetailPageHeaderProps {
  title: string;
  status?: string;

  statusTone?: TagTone;
  onBack?: () => void;

  headerRight?: React.ReactNode;
  actions?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?:
      | "default"
      | "destructive"
      | "outline"
      | "secondary"
      | "ghost"
      | "link";
  }[];
  className?: string;
}

const DetailPageHeader = React.forwardRef<
  HTMLDivElement,
  DetailPageHeaderProps
>(
  (
    {
      title,
      status,
      statusTone = "neutral",
      onBack,
      headerRight,
      actions,
      className,
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h1 className="truncate text-2xl font-semibold leading-8 tracking-tight">
            {title}
          </h1>
          {status && <Tag tone={statusTone}>{status}</Tag>}
        </div>
      </div>
      {(headerRight || (actions && actions.length > 0)) && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {headerRight}
          {actions?.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || "outline"}
              onClick={action.onClick}
              className="flex items-center gap-2"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
);
DetailPageHeader.displayName = "DetailPageHeader";

interface DetailCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  dense?: boolean;
}

const DetailCard = ({
  title,
  children,
  className,
  headerActions,
  description,
  icon,
  footer,
  dense = false,
}: DetailCardProps) => (
  <Card className={cn("border", className)}>
    <CardHeader
      className={cn("border-b bg-surface-subtle/60 pb-4", dense && "py-3")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground [&>svg]:size-4">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <CardTitle
              className={cn("text-base leading-6", dense && "text-sm")}
            >
              {title}
            </CardTitle>
            {description && (
              <p
                className={cn(
                  "mt-1 text-sm text-muted-foreground",
                  dense && "mt-0.5 text-xs"
                )}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {headerActions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {headerActions}
          </div>
        )}
      </div>
    </CardHeader>
    <CardContent className={cn(dense ? "py-4" : "py-5")}>
      {children}
    </CardContent>
    {footer && (
      <div className={cn("border-t px-5 pb-5 pt-4", dense && "px-4 pb-4 pt-3")}>
        {footer}
      </div>
    )}
  </Card>
);
DetailCard.displayName = "DetailCard";

interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
  className?: string;
}

const ActivityItem = React.forwardRef<HTMLDivElement, ActivityItemProps>(
  ({ title, description, time, className }, ref) => (
    <div ref={ref} className={cn("flex items-start gap-3 py-3", className)}>
      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{title}</h4>
          <span className="text-sm text-muted-foreground">{time}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  )
);
ActivityItem.displayName = "ActivityItem";

interface LeadScoreProps {
  score: number;
  maxScore?: number;
  description?: string;
  className?: string;
}

const LeadScore = React.forwardRef<HTMLDivElement, LeadScoreProps>(
  ({ score, maxScore = 100, description, className }, ref) => (
    <div ref={ref} className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Lead Score</span>
        <span className="text-sm font-medium">
          {score}/{maxScore}
        </span>
      </div>
      <Progress value={(score / maxScore) * 100} className="h-2" />
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
);
LeadScore.displayName = "LeadScore";

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}

const QuickAction = ({ icon, label, onClick, className }: QuickActionProps) => (
  <Button
    variant="outline"
    onClick={onClick}
    className={cn("w-full justify-start gap-3", className)}
  >
    {icon}
    {label}
  </Button>
);

export { DetailPageHeader, DetailCard, ActivityItem, LeadScore, QuickAction };
