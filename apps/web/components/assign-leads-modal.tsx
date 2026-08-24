"use client";

import { leadService, userService } from "@/lib/api/services";
import { ApiError, User } from "@/lib/api/types";
import { Avatar } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Filter, Mail, Search, TrendingUp, Users } from "@repo/ui/icons";
import * as React from "react";

interface AssignLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (salesPersonId: number) => void;
  selectedLeadsCount: number;
}

interface UserStats {
  totalLeads: number;
  totalConverted: number;
  conversionRate: number;
  totalRemaining: number;
}

// Helper function to format region for display
const formatRegion = (region?: string): string => {
  if (!region) return "-";
  const regionMap: Record<string, string> = {
    SOUTH: "South",
    NORTH: "North",
    EAST: "East",
    WEST_1: "West 1",
    WEST_2: "West 2",
    APTOC: "APTOC",
  };
  return regionMap[region] || region;
};

export function AssignLeadsModal({
  open,
  onOpenChange,
  onAssign,
  selectedLeadsCount,
}: AssignLeadsModalProps) {
  const [selectedSalesPerson, setSelectedSalesPerson] = React.useState<
    number | null
  >(null);
  const [assignableUsers, setAssignableUsers] = React.useState<User[]>([]);
  const [userStats, setUserStats] = React.useState<Record<number, UserStats>>(
    {}
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedRegion, setSelectedRegion] = React.useState<string>("all");

  // Fetch sales users and their stats when modal opens
  React.useEffect(() => {
    if (open) {
      fetchAssignableUsersAndStats();
    }
  }, [open]);

  const fetchAssignableUsersAndStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const usersResponse = await userService.getAllUsers({ role: "SALES" });
      const users = usersResponse?.data || [];

      const filtered = users.filter(u => {
        const role = String(u.role || "").toUpperCase();
        return role === "SALES";
      });
      setAssignableUsers(filtered);

      const stats: Record<number, UserStats> = {};

      try {
        const assignmentStatsRaw = await leadService.getAssignmentStats();
        const assignmentStats = Array.isArray(assignmentStatsRaw)
          ? assignmentStatsRaw
          : [];

        assignmentStats.forEach(stat => {
          stats[stat.userId] = {
            totalLeads: stat.totalLeads,
            totalConverted: stat.totalConverted,
            totalRemaining: stat.totalRemaining,
            conversionRate: stat.conversionRate,
          };
        });

        if (
          !Array.isArray(assignmentStatsRaw) &&
          assignmentStatsRaw !== undefined
        ) {
          console.warn(
            "Unexpected assignment stats response:",
            assignmentStatsRaw
          );
        }
      } catch (statsError) {
        console.warn(
          "Failed to load assignment stats. Falling back to zeroed stats.",
          statsError
        );
      }

      filtered.forEach(user => {
        if (!stats[user.id]) {
          stats[user.id] = {
            totalLeads: 0,
            totalConverted: 0,
            totalRemaining: 0,
            conversionRate: 0,
          };
        }
      });

      setUserStats(stats);
    } catch (err) {
      console.error("Failed to fetch users and stats for assignment:", err);

      const apiError = err as ApiError | undefined;
      if (apiError?.status === 403) {
        setError("You do not have permission to assign leads.");
      } else {
        const fallbackMessage =
          apiError?.message || (err instanceof Error ? err.message : null);
        setError(
          fallbackMessage ||
            "Failed to load users and statistics. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = () => {
    if (selectedSalesPerson) {
      onAssign(selectedSalesPerson);
      onOpenChange(false);
      setSelectedSalesPerson(null);
      setSearchQuery("");
      setSelectedRegion("all");
    }
  };

  // Filter users based on search query and region
  const filteredUsers = React.useMemo(() => {
    let filtered = assignableUsers;

    // Filter by region first
    if (selectedRegion && selectedRegion !== "all") {
      filtered = filtered.filter(user => user.region === selectedRegion);
    }

    // Then filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => {
        const fullName = [user.firstName, user.lastName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          fullName.includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.role?.toLowerCase().includes(query) ||
          formatRegion(user.region).toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [assignableUsers, searchQuery, selectedRegion]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[37.5rem]">
        <div>
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5" />
              Assign Leads to User
            </DialogTitle>
            <DialogDescription className="text-center">
              Select a user (Admin or Sales) to assign {selectedLeadsCount}{" "}
              selected lead{selectedLeadsCount > 1 ? "s" : ""} to.
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar and Region Filter */}
          <div className="space-y-3 mt-4">
            <div className="relative">
              <Search className="absolute left-3 inset-y-0 my-auto h-fit h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, role, or region..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="region-filter"
                className="text-sm flex items-center gap-1"
              >
                <Filter className="h-3 w-3" />
                Region:
              </Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger
                  id="region-filter"
                  className="w-full sm:w-[11.25rem]"
                >
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="SOUTH">South</SelectItem>
                  <SelectItem value="NORTH">North</SelectItem>
                  <SelectItem value="EAST">East</SelectItem>
                  <SelectItem value="WEST_1">West 1</SelectItem>
                  <SelectItem value="WEST_2">West 2</SelectItem>
                  <SelectItem value="APTOC">APTOC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 max-h-[25rem] overflow-y-auto mt-4">
            {loading && (
              <div className="flex items-center justify-center py-8"></div>
            )}

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAssignableUsersAndStats}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            )}

            {!loading && !error && assignableUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No assignable users found.</p>
              </div>
            )}

            {!loading &&
              !error &&
              filteredUsers.length === 0 &&
              (searchQuery || (selectedRegion && selectedRegion !== "all")) && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>
                    {searchQuery && selectedRegion && selectedRegion !== "all"
                      ? `No users found matching "${searchQuery}" in ${formatRegion(selectedRegion)}.`
                      : searchQuery
                        ? `No users found matching "${searchQuery}".`
                        : selectedRegion && selectedRegion !== "all"
                          ? `No users found in ${formatRegion(selectedRegion)}.`
                          : "No users found."}
                  </p>
                </div>
              )}

            {!loading &&
              !error &&
              filteredUsers.map(person => {
                const stats = userStats[person.id] || {
                  totalLeads: 0,
                  totalConverted: 0,
                  conversionRate: 0,
                  totalRemaining: 0,
                };

                return (
                  <div
                    key={person.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedSalesPerson === person.id}
                    className={`p-3 border rounded-lg cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 ${
                      selectedSalesPerson === person.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedSalesPerson(person.id)}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedSalesPerson(person.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <div className="h-full w-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {[person.firstName, person.lastName]
                              .filter(Boolean)
                              .map(n => n?.[0] || "")
                              .join("") || "U"}
                          </span>
                        </div>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm">
                            {[person.firstName, person.lastName]
                              .filter(Boolean)
                              .join(" ") || "Unknown User"}
                          </h3>
                          <Badge variant="secondary">
                            {person.role || "USER"}
                          </Badge>
                          {person.region && (
                            <Badge variant="outline">
                              {formatRegion(person.region)}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{person.email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Statistics - Horizontal Layout */}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex flex-col items-center">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-semibold">
                            {stats.totalLeads}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-muted-foreground">
                            Converted
                          </span>
                          <span className="font-semibold text-success-foreground">
                            {stats.totalConverted}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-muted-foreground">
                            Remaining
                          </span>
                          <span className="font-semibold text-warning-foreground">
                            {stats.totalRemaining}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Rate
                          </span>
                          <span className="font-semibold">
                            {stats.conversionRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {selectedSalesPerson === person.id && (
                        <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-surface"></div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <DialogFooter className="flex justify-center gap-2 mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedSalesPerson || loading}
            >
              Assign to{" "}
              {selectedSalesPerson
                ? (() => {
                    const p = assignableUsers.find(
                      p => p.id === selectedSalesPerson
                    );
                    return (
                      [p?.firstName, p?.lastName].filter(Boolean).join(" ") ||
                      "User"
                    );
                  })()
                : "User"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
