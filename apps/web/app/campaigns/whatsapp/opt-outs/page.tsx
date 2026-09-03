"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Ban, CheckCircle, Plus, Search } from "@repo/ui/icons";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DataTable, TableColumn } from "../../../../components/data-table";
import apiClient from "../../../../lib/api/client";
import { toast } from "../../../../lib/toast";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { PageHeader } from "@repo/ui/components/ui/page-header";

interface OptOut {
  id: number;
  phone: string;
  channel: string;
  optedOutAt: string;
  source: string;
  campaignId?: number;
  reason?: string;
  campaign?: {
    id: number;
    name: string;
  };
}

interface OptOutStats {
  total: number;
}

export default function OptOutsPage() {
  const router = useRouter();
  const [optOuts, setOptOuts] = useState<OptOut[]>([]);
  const [stats, setStats] = useState<OptOutStats | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedOptOut, setSelectedOptOut] = useState<OptOut | null>(null);

  const [newOptOut, setNewOptOut] = useState({
    phone: "",
    reason: "",
  });

  const fetchOptOuts = async () => {
    try {
      const skip = (currentPage - 1) * itemsPerPage;
      const params = new URLSearchParams({
        skip: skip.toString(),
        take: itemsPerPage.toString(),
        sortBy: "optedOutAt",
        sortOrder: "desc",
      });

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await apiClient.get(`/api/whatsapp/optouts?${params}`);
      const data = response.data;

      setOptOuts(data.data || []);
      setTotalCount(data.pagination.total);
    } catch (error) {
      toast.error(error, "Error");
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get("/api/whatsapp/optouts/stats");
      setStats(response.data);
    } catch {
      setStats(null);
    }
  };

  useEffect(() => {
    fetchOptOuts();
    fetchStats();
  }, [currentPage, itemsPerPage, searchQuery]);

  const handleAddOptOut = async () => {
    try {
      await apiClient.post("/api/whatsapp/optout", newOptOut);

      toast.success("Phone number added to opt-out list");
      setAddDialogOpen(false);
      setNewOptOut({ phone: "", reason: "" });
      fetchOptOuts();
      fetchStats();
    } catch (error) {
      toast.error(error, "Error");
    }
  };

  const handleRemoveOptOut = async () => {
    if (!selectedOptOut) return;

    try {
      await apiClient.delete("/api/whatsapp/optout", {
        data: {
          phone: selectedOptOut.phone,
        },
      });

      toast.success("Opt-out removed successfully");
      setRemoveDialogOpen(false);
      setSelectedOptOut(null);
      fetchOptOuts();
      fetchStats();
    } catch (error) {
      toast.error(error, "Error");
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchOptOuts();
  };

  const columns: TableColumn<OptOut>[] = [
    {
      key: "phone",
      label: "Phone Number",
      render: value => <span className="font-mono text-sm">+{value}</span>,
    },
    {
      key: "optedOutAt",
      label: "Opted Out Date",
      render: value => new Date(value).toLocaleString(),
    },
    {
      key: "source",
      label: "Source",
      render: value => <Badge variant="outline">{value || "manual"}</Badge>,
    },
    {
      key: "campaign",
      label: "Campaign",
      render: (_value, item) =>
        item.campaign ? (
          <span className="text-sm text-muted-foreground">
            {item.campaign.name}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      key: "reason",
      label: "Reason",
      render: value => (
        <span className="text-sm text-muted-foreground max-w-xs truncate">
          {value || "-"}
        </span>
      ),
    },
  ];

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <PageShell>
      <PageHeader
        title="WhatsApp opt-outs"
        description="People who asked to stop getting WhatsApp messages. Every campaign skips them automatically."
        actions={
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Add Opt-Out
              </Button>
            </DialogTrigger>
            <DialogContent className="gap-0 overflow-hidden">
              <DialogHeader>
                <DialogTitle>Add Phone to WhatsApp Opt-Out List</DialogTitle>
                <DialogDescription>
                  Manually add a phone number to the WhatsApp opt-out list
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-3">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="919876543210"
                    value={newOptOut.phone}
                    onChange={e =>
                      setNewOptOut({ ...newOptOut, phone: e.target.value })
                    }
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter phone number with country code (e.g., 919876543210)
                  </p>
                </div>
                <div>
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Input
                    id="reason"
                    placeholder="Customer request, compliance, etc."
                    value={newOptOut.reason}
                    onChange={e =>
                      setNewOptOut({ ...newOptOut, reason: e.target.value })
                    }
                  />
                </div>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddOptOut}>Add Opt-Out</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {stats && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total WhatsApp Opt-Outs
            </CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Phone numbers that have opted out of WhatsApp communications
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search Opt-Outs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="search">Search by Phone Number</Label>
              <Input
                id="search"
                placeholder="Search phone number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        data={optOuts}
        columns={columns}
        title="Opt-Outs"
        count={totalCount}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={value => {
          setItemsPerPage(value);
          setCurrentPage(1);
        }}
        customActions={item => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedOptOut(item);
              setRemoveDialogOpen(true);
            }}
          >
            <CheckCircle className="h-4 w-4" />
            Remove
          </Button>
        )}
      />

      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="gap-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Remove Opt-Out</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this phone number from the opt-out
              list? They will be able to receive communications again.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {selectedOptOut && (
              <div className="space-y-2">
                <p>
                  <strong>Phone:</strong> +{selectedOptOut.phone}
                </p>
                <p className="text-sm text-muted-foreground">
                  This will remove the phone number from the WhatsApp opt-out
                  list.
                </p>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleRemoveOptOut}>Remove Opt-Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
