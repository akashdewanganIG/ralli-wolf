"use client";

import type { TableColumn } from "@/components/data-table";
import { DataTable } from "@/components/data-table";
import { RoleGuard, useIsAdmin } from "@/components/guards/RoleGuard";
import { AddOpportunityLineItemDialog } from "@/components/opportunities/add-opportunity-line-item-dialog";
import {
  LEAD_SOURCES,
  OPPORTUNITY_TYPES,
} from "@/components/opportunities/opportunity-enums";
import { CreateQuoteDialog } from "@/components/quotes/create-quote-dialog";
import type { Quote } from "@/components/quotes/quote-types";
import { QuotesTable } from "@/components/quotes/quotes-table";
import { DetailPageSkeleton, TableSkeleton } from "@/components/skeletons";
import {
  useDeleteOpportunity,
  useDeleteOpportunityLineItem,
  useOpportunity,
  useOpportunityLineItems,
  useOpportunityQuotes,
  useUpdateOpportunity,
  useUpdateOpportunityLineItem,
  useUpdateOpportunityStage,
} from "@/hooks/useOpportunities";
import { usePricebooksWithPagination } from "@/hooks/usePricebooks";
import type { OpportunityLineItem } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import {
  Badge,
  Button,
  ConfirmationDialog,
  DeleteConfirmationDialog,
  DetailCard,
  DetailPageHeader,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  InfoField,
  InfoGrid,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stepper,
  Tabs,
  TabsContent,
  TabsContents,
  Textarea,
} from "@repo/ui";
import { Pencil, Trash2, X } from "@repo/ui/icons";
import { useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import * as React from "react";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { Tag, type TagTone } from "@repo/ui/components/ui/tag";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function buildFullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ") || "N/A";
}

/**
 * Opportunity stage → tone.
 *
 * A stage is a position in a pipeline, not a verdict, so the early ones stay
 * neutral; only negotiation (at risk) and the two closed outcomes carry a
 * colour.
 */
const STAGE_TONE: Record<string, TagTone> = {
  PROSPECT: "neutral",
  QUALIFICATION: "neutral",
  DISCOVERY: "neutral",
  VALUE_PROPOSITION: "neutral",
  PROPOSAL: "neutral",
  NEGOTIATION: "pending",
  CLOSED_WON: "active",
  CLOSED_LOST: "danger",
};

// Stages without CLOSED_LOST for the stepper
const STEPS_WITHOUT_CLOSED_LOST = [
  "PROSPECT",
  "QUALIFICATION",
  "DISCOVERY",
  "VALUE_PROPOSITION",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
];

function ProductLineItemsTable({
  opportunityId,
  priceBook,
}: {
  opportunityId: number;
  priceBook?: { id: number; name: string } | null;
}) {
  const {
    data: lineItems = [],
    isLoading,
    isError,
  } = useOpportunityLineItems(opportunityId);
  const updateLineItem = useUpdateOpportunityLineItem();
  const deleteLineItem = useDeleteOpportunityLineItem();
  const updateOpportunity = useUpdateOpportunity();
  const { data: pricebooks } = usePricebooksWithPagination();
  const isAdmin = useIsAdmin();

  // Add line item dialog state
  const [addOpen, setAddOpen] = React.useState(false);

  // Edit modal state
  const [editItem, setEditItem] = React.useState<OpportunityLineItem | null>(
    null
  );
  const [editOpen, setEditOpen] = React.useState(false);

  // Delete confirmation state
  const [deleteItem, setDeleteItem] =
    React.useState<OpportunityLineItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [editQuantity, setEditQuantity] = React.useState(1);
  const [editListPrice, setEditListPrice] = React.useState(0);
  const [editDiscount, setEditDiscount] = React.useState(0);
  const [editDescription, setEditDescription] = React.useState("");

  // Pricebook dialog state
  const [showChangePriceBookConfirm, setShowChangePriceBookConfirm] =
    React.useState(false);
  const [priceBookDialogOpen, setPriceBookDialogOpen] = React.useState(false);
  const [selectedPriceBookId, setSelectedPriceBookId] = React.useState("");

  const openEdit = (item: OpportunityLineItem) => {
    setEditItem(item);
    setEditQuantity(item.quantity);
    setEditListPrice(Number(item.listPrice));
    setEditDiscount(Number(item.discount));
    setEditDescription(item.description ?? "");
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editItem) return;
    updateLineItem.mutate(
      {
        opportunityId,
        lineItemId: editItem.id,
        data: {
          quantity: editQuantity,
          listPrice: editListPrice,
          discount: editDiscount,
          description: editDescription || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Line item updated successfully");
          setEditOpen(false);
        },
        onError: error => {
          toast.error(error, "Failed to update line item");
        },
      }
    );
  };

  const handlePriceBookButtonClick = () => {
    setPriceBookDialogOpen(true);
  };

  // Called when user clicks OK in the selection dialog
  const handlePriceBookSelectionNext = () => {
    if (!selectedPriceBookId) return;
    if (priceBook) {
      // Already has a pricebook — close selection, show warning
      setPriceBookDialogOpen(false);
      setShowChangePriceBookConfirm(true);
    } else {
      // No existing pricebook — save directly, no warning needed
      handleSavePriceBook();
    }
  };

  // Final save — called after warning confirmation (or directly when adding for the first time)
  const handleSavePriceBook = () => {
    if (!selectedPriceBookId) return;
    updateOpportunity.mutate(
      { id: opportunityId, data: { priceBookId: Number(selectedPriceBookId) } },
      {
        onSuccess: () => {
          setShowChangePriceBookConfirm(false);
          setPriceBookDialogOpen(false);
          setSelectedPriceBookId("");
        },
      }
    );
  };

  const handleDeleteLineItem = () => {
    if (!deleteItem) return;
    deleteLineItem.mutate(
      { opportunityId, lineItemId: deleteItem.id },
      {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          setDeleteItem(null);
        },
      }
    );
  };

  // Calculated preview values for edit modal
  const unitPricePreview = editListPrice * (1 - editDiscount / 100);
  const totalPricePreview = editQuantity * unitPricePreview;

  const columns: TableColumn<OpportunityLineItem>[] = [
    {
      key: "product",
      label: "Product Name",
      render: (_: any, item: OpportunityLineItem) => item.product?.name ?? "—",
    },
    {
      key: "productCode",
      label: "Product Code",
      render: (_: any, item: OpportunityLineItem) => item.product?.code ?? "—",
    },
    { key: "quantity", label: "Quantity" },
    {
      key: "listPrice",
      label: "List Price",
      render: (val: any) => (val != null ? `$${Number(val).toFixed(2)}` : "—"),
    },
    {
      key: "discount",
      label: "Discount (%)",
      render: (val: any) => (val != null ? `${Number(val).toFixed(2)}%` : "—"),
    },
    {
      key: "unitPrice",
      label: "Unit Price",
      render: (val: any) => (val != null ? `$${Number(val).toFixed(2)}` : "—"),
    },
    {
      key: "totalPrice",
      label: "Total Price",
      render: (val: any) => (val != null ? `$${Number(val).toFixed(2)}` : "—"),
    },
  ];

  const tableHeaderActions = (
    <div className="inline-flex items-center gap-2">
      <Button size="sm" onClick={() => setAddOpen(true)}>
        Add Line Item
      </Button>
      <div className="inline-flex items-center rounded-full border border-input bg-surface">
        <Button
          type="button"
          variant="outline"
          onClick={handlePriceBookButtonClick}
          className="whitespace-nowrap"
        >
          {priceBook ? "Change Pricebook" : "Add Pricebook"}
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-sm text-destructive py-4">
        Failed to load line items.
      </div>
    );
  }

  return (
    <>
      <DataTable<OpportunityLineItem>
        data={lineItems}
        columns={columns}
        title="Product Line Items"
        count={lineItems.length}
        columnPreferenceKey="opportunity-line-items"
        headerTrailingContent={tableHeaderActions}
        titleSuffix={
          priceBook ? (
            <Badge
              variant="outline"
              className="text-xs font-medium text-muted-foreground border-input"
            >
              {priceBook.name}
            </Badge>
          ) : undefined
        }
        customActions={item => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => openEdit(item as OpportunityLineItem)}
              aria-label="Edit line item"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                disabled={
                  deleteLineItem.isPending &&
                  deleteItem?.id === (item as OpportunityLineItem).id
                }
                onClick={() => {
                  setDeleteItem(item as OpportunityLineItem);
                  setShowDeleteConfirm(true);
                }}
                aria-label="Delete line item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      />

      {/* Edit Line Item Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit Line Item — {editItem?.product?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={editQuantity}
                onChange={e => setEditQuantity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>List Price ($)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={editListPrice}
                onChange={e => setEditListPrice(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Discount (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={editDiscount}
                onChange={e => setEditDiscount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit Price ($)</Label>
              <Input value={unitPricePreview.toFixed(2)} disabled />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Total Price ($)</Label>
              <Input value={totalPricePreview.toFixed(2)} disabled />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="min-h-[5rem]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateLineItem.isPending}
            >
              {updateLineItem.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning confirmation — shown after pricebook is selected, before saving */}
      <ConfirmationDialog
        open={showChangePriceBookConfirm}
        onOpenChange={open => {
          setShowChangePriceBookConfirm(open);
          if (!open) setSelectedPriceBookId("");
        }}
        onConfirm={handleSavePriceBook}
        title="Change Pricebook"
        description="If you change the price book, all existing line items for this opportunity will be deleted. This action cannot be undone."
        confirmText={updateOpportunity.isPending ? "Saving..." : "Confirm"}
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Confirmation dialog for deleting a line item */}
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={open => {
          setShowDeleteConfirm(open);
          if (!open) setDeleteItem(null);
        }}
        onConfirm={handleDeleteLineItem}
        title="Delete Product"
        description={`Are you sure you want to delete "${deleteItem?.product?.name ?? "this product"}" from the opportunity?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteLineItem.isPending}
      />

      {/* Pricebook selection dialog */}
      <Dialog
        open={priceBookDialogOpen}
        onOpenChange={open => {
          setPriceBookDialogOpen(open);
          if (!open) setSelectedPriceBookId("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {priceBook ? "Change Pricebook" : "Add Pricebook"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label>Select Pricebook</Label>
            <Select
              value={selectedPriceBookId}
              onValueChange={setSelectedPriceBookId}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select a pricebook" />
              </SelectTrigger>
              <SelectContent>
                {pricebooks.map(pb => (
                  <SelectItem key={pb.id} value={String(pb.id)}>
                    {pb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPriceBookDialogOpen(false);
                setSelectedPriceBookId("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePriceBookSelectionNext}
              disabled={!selectedPriceBookId}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Line Item dialog */}
      <AddOpportunityLineItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        opportunityId={opportunityId}
        priceBook={priceBook}
      />
    </>
  );
}

function OpportunityDetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const { data: response, isLoading, isError } = useOpportunity(id);
  const updateStage = useUpdateOpportunityStage();
  const updateOpportunity = useUpdateOpportunity();
  const deleteOpportunity = useDeleteOpportunity();
  const isAdmin = useIsAdmin();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const opportunity = response?.data;

  // ── Stepper state ──────────────────────────────────────────────────────────
  const currentStageIndex = opportunity
    ? Math.max(0, STEPS_WITHOUT_CLOSED_LOST.indexOf(opportunity.stage))
    : 0;
  const [selectedStageIndex, setSelectedStageIndex] =
    React.useState(currentStageIndex);
  React.useEffect(() => {
    setSelectedStageIndex(currentStageIndex);
  }, [currentStageIndex]);
  const hasStageChanged = selectedStageIndex !== currentStageIndex;
  const handleSaveStage = React.useCallback(() => {
    if (!opportunity || !hasStageChanged) return;
    const stage = STEPS_WITHOUT_CLOSED_LOST[selectedStageIndex];
    if (!stage) return;
    updateStage.mutate({ id: opportunity.id, stage });
  }, [opportunity, selectedStageIndex, hasStageChanged, updateStage]);

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("details")
  );

  // ── Quotes: fetch from API (GET /api/opportunities/:id/quotes)
  const { data: quotesResponse } = useOpportunityQuotes(id, {
    page: 1,
    limit: 50,
  });

  // ── Create Quote dialog ─────────────────────────────────────────────────────
  const [createQuoteOpen, setCreateQuoteOpen] = React.useState(false);

  // ── Inline edit state ──────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editCloseDate, setEditCloseDate] = React.useState("");
  const [editNextStep, setEditNextStep] = React.useState("");
  const [editType, setEditType] = React.useState("");
  const [editLeadSource, setEditLeadSource] = React.useState("");

  const startEditing = React.useCallback(() => {
    if (!opportunity) return;
    setEditName(opportunity.name);
    setEditCloseDate(
      opportunity.expectedCloseDate
        ? new Date(opportunity.expectedCloseDate).toISOString().slice(0, 10)
        : ""
    );
    setEditNextStep(opportunity.nextStep ?? "");
    setEditType(opportunity.type ?? "__none__");
    setEditLeadSource(opportunity.leadSource ?? "__none__");
    setIsEditing(true);
  }, [opportunity]);

  const cancelEditing = () => setIsEditing(false);

  const handleSaveFields = React.useCallback(() => {
    if (!opportunity) return;

    const payload: Parameters<typeof updateOpportunity.mutate>[0]["data"] = {};

    if (editName.trim() && editName.trim() !== opportunity.name)
      payload.name = editName.trim();

    const apiDate = opportunity.expectedCloseDate
      ? new Date(opportunity.expectedCloseDate).toISOString().slice(0, 10)
      : "";
    if (editCloseDate !== apiDate)
      payload.expectedCloseDate = editCloseDate || null;

    const apiNextStep = opportunity.nextStep ?? "";
    if (editNextStep !== apiNextStep) payload.nextStep = editNextStep || null;

    const apiType = opportunity.type ?? "__none__";
    if (editType !== apiType)
      payload.type = editType === "__none__" ? null : editType;

    const apiLeadSource = opportunity.leadSource ?? "__none__";
    if (editLeadSource !== apiLeadSource)
      payload.leadSource =
        editLeadSource === "__none__" ? null : editLeadSource;

    if (Object.keys(payload).length === 0) {
      setIsEditing(false);
      return;
    }

    updateOpportunity.mutate(
      { id: opportunity.id, data: payload },
      {
        onSuccess: () => {
          toast.success("Opportunity updated successfully");
          setIsEditing(false);
        },
        onError: error => {
          toast.error(error, "Failed to update opportunity");
        },
      }
    );
  }, [
    opportunity,
    editName,
    editCloseDate,
    editNextStep,
    editType,
    editLeadSource,
    updateOpportunity,
  ]);

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    try {
      await deleteOpportunity.mutateAsync(id);
      setShowDeleteDialog(false);
      router.push("/sales/opportunities");
    } catch {
      toast.error("Failed to delete opportunity");
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (isError || !opportunity) {
    return (
      <PageShell>
        <div className="text-lg font-semibold">Opportunity not found</div>
        <Button
          variant="outline"
          onClick={() => router.push("/sales/opportunities")}
        >
          Back to Opportunities
        </Button>
      </PageShell>
    );
  }

  // Map GET /api/opportunities/:id/quotes response to Quote type for QuotesTable
  const relatedQuotes: Quote[] = (quotesResponse?.data ?? []).map(q => ({
    id: String(q.id),
    quoteNumber: q.quoteNumber,
    isPrimary: q.isPrimary,
    netAmount:
      typeof q.grandTotal === "number"
        ? q.grandTotal
        : Number(q.grandTotal) || 0,
    lineItemCount: 0,
    status: q.status as Quote["status"],
    createdBy: "",
    createdAt: q.createdAt,
    lastModifiedBy: "",
    lastModifiedAt: q.createdAt,
    startDate: "",
    endDate: "",
    opportunityId: String(opportunity.id),
    opportunityName: opportunity.name,
    accountId: opportunity.account.id,
    accountName: opportunity.account.name,
  }));

  // Header actions for the Opportunity Information card
  const cardHeaderActions = isEditing ? (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={cancelEditing}
        disabled={updateOpportunity.isPending}
      >
        <X className="h-3.5 w-3.5 mr-1" />
        Cancel
      </Button>
      <Button
        size="sm"
        onClick={handleSaveFields}
        disabled={updateOpportunity.isPending}
      >
        {updateOpportunity.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  ) : (
    <Button size="sm" variant="outline" onClick={startEditing}>
      <Pencil className="h-3.5 w-3.5 mr-1" />
      Edit
    </Button>
  );

  return (
    <div className="p-4 space-y-4">
      <DetailPageHeader
        title={opportunity.name}
        onBack={() => router.push("/sales/opportunities")}
      />

      {/* Stage stepper */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <Stepper
            steps={STEPS_WITHOUT_CLOSED_LOST}
            currentIndex={selectedStageIndex}
            className="rounded-sm"
            onStepClick={setSelectedStageIndex}
          />
        </div>
        <Button
          className="mt-0 self-start"
          onClick={handleSaveStage}
          disabled={!hasStageChanged || updateStage.isPending}
        >
          {updateStage.isPending ? "Saving..." : "Save"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v)}>
        <div className="flex items-center justify-between gap-3">
          <CategorySwitcher
            label="Opportunity sections"
            items={[
              { value: "details", label: "Details" },
              { value: "products", label: "Products" },
              { value: "quotes", label: "Quotes" },
            ]}
          />
          {isAdmin && tab === "details" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Opportunity
            </Button>
          )}
        </div>

        <TabsContents>
          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Main info card */}
              <div className="lg:col-span-2 space-y-4">
                <DetailCard
                  title="Opportunity Information"
                  className="bg-surface-elevated/50 border-border"
                  headerActions={cardHeaderActions}
                >
                  <InfoGrid columns={2}>
                    {/* Opportunity Name */}
                    <InfoField
                      label="Opportunity Name"
                      value={isEditing ? editName : opportunity.name}
                      editable={isEditing}
                      onChange={setEditName}
                    />

                    {/* Stage — read-only here; stepper above handles edits */}
                    <div className="space-y-1.5">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Stage
                      </p>
                      <Tag tone={STAGE_TONE[opportunity.stage] ?? "neutral"}>
                        {opportunity.stage}
                      </Tag>
                    </div>

                    {/* Type */}
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          Type
                        </Label>
                        <Select value={editType} onValueChange={setEditType}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— None —</SelectItem>
                            {OPPORTUNITY_TYPES.map(t => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <InfoField label="Type" value={opportunity.type || ""} />
                    )}

                    {/* Lead Source */}
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          Lead Source
                        </Label>
                        <Select
                          value={editLeadSource}
                          onValueChange={setEditLeadSource}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select lead source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— None —</SelectItem>
                            {LEAD_SOURCES.map(ls => (
                              <SelectItem key={ls} value={ls}>
                                {ls}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <InfoField
                        label="Lead Source"
                        value={opportunity.leadSource || ""}
                      />
                    )}

                    {/* Close Date */}
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          Close Date
                        </Label>
                        <Input
                          type="date"
                          value={editCloseDate}
                          onChange={e => setEditCloseDate(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                    ) : (
                      <InfoField
                        label="Close Date"
                        value={
                          opportunity.expectedCloseDate
                            ? new Date(
                                opportunity.expectedCloseDate
                              ).toLocaleDateString("en-GB")
                            : ""
                        }
                      />
                    )}

                    {/* Next Step */}
                    <InfoField
                      label="Next Step"
                      value={
                        isEditing ? editNextStep : opportunity.nextStep || ""
                      }
                      editable={isEditing}
                      onChange={setEditNextStep}
                    />

                    {/* Amount — read-only */}
                    <InfoField
                      label="Amount"
                      value={
                        opportunity.amount != null
                          ? `$${Number(opportunity.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : ""
                      }
                    />

                    {/* Account — read-only */}
                    <InfoField
                      label="Account"
                      value={`${opportunity.account.name} (ID: ${opportunity.account.id})`}
                    />

                    {/* Contact — read-only */}
                    <InfoField
                      label="Contact"
                      value={
                        opportunity.contact
                          ? `${opportunity.contact.name} (ID: ${opportunity.contact.id})`
                          : ""
                      }
                    />

                    {/* Description — read-only (not in PATCH) */}
                    <div className="col-span-2 space-y-1.5 pt-4 mt-4 border-t border-border">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Description
                      </p>
                      <div className="text-sm sm:text-base leading-6 text-foreground font-medium whitespace-pre-wrap">
                        {opportunity.description || (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </div>
                  </InfoGrid>
                </DetailCard>
              </div>

              {/* System info card */}
              <div className="h-full">
                <DetailCard
                  title="System Information"
                  className="bg-surface-elevated/50 border-border h-full"
                >
                  <InfoGrid columns={1}>
                    <InfoField
                      label="Opportunity Owner"
                      value={buildFullName(
                        opportunity.owner.firstName,
                        opportunity.owner.lastName
                      )}
                    />
                    <InfoField
                      label="Created By"
                      value={buildFullName(
                        opportunity.creator.firstName,
                        opportunity.creator.lastName
                      )}
                    />
                    <InfoField
                      label="Created At"
                      value={formatDateTime(opportunity.createdAt)}
                    />
                    <InfoField
                      label="Last Modified At"
                      value={formatDateTime(opportunity.updatedAt)}
                    />
                  </InfoGrid>
                </DetailCard>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="quotes">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-3">
                <QuotesTable
                  quotes={relatedQuotes}
                  title="Quotes"
                  showCreateButton={true}
                  onCreateClick={() => setCreateQuoteOpen(true)}
                  onQuoteClick={quote =>
                    router.push(`/sales/quotes/${quote.id}`)
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="products">
            <ProductLineItemsTable
              opportunityId={opportunity.id}
              priceBook={opportunity.priceBook}
            />
          </TabsContent>
        </TabsContents>
      </Tabs>

      <CreateQuoteDialog
        open={createQuoteOpen}
        onOpenChange={setCreateQuoteOpen}
        opportunityId={String(opportunity.id)}
        opportunityName={opportunity.name}
      />

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
        itemName={opportunity.name}
        itemType="opportunity"
        isLoading={deleteOpportunity.isPending}
      />
    </div>
  );
}

export default function OpportunityDetailPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN", "ADMIN", "SALES"]}>
      <NuqsAdapter>
        <OpportunityDetailContent />
      </NuqsAdapter>
    </RoleGuard>
  );
}
