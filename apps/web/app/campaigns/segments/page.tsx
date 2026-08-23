"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Plus, Eye, Pencil, Trash } from "@repo/ui/icons";
import { toast } from "@/lib/toast";
import { segmentService } from "@/lib/api/services";
import { Segment, SegmentPayload } from "@/lib/api/types";
import {
  useSegments,
  useCreateSegment,
  useUpdateSegment,
  useDeleteSegment,
} from "@/hooks/useSegments";
import {
  SegmentFormModal,
  SegmentFormValues,
} from "@/components/segment-form-modal";
import { PageShell } from "@repo/ui/components/ui/page-shell";

function getRuleSummary(segment: Segment) {
  if (!segment.rules?.length) return "No rules";
  return segment.rules
    .map(rule => {
      const label =
        rule.ruleType === "KEYWORD"
          ? `${rule.ruleType.toLowerCase()} (${Array.isArray(rule.value) ? rule.value.length : 0})`
          : `${rule.ruleType.toLowerCase()}`;
      const operatorLabel = rule.operator === "NOT_IN" ? "not" : "in";
      return `${label} ${operatorLabel}`;
    })
    .join(" • ");
}

function transformSegmentToFormValues(segment: Segment): SegmentFormValues {
  return {
    name: segment.name,
    description: segment.description || undefined,
    logicOperator: segment.logicOperator,
    rules: segment.rules.map(rule => ({
      id: rule.id.toString(),
      ruleType: rule.ruleType,
      operator: rule.operator,
      keywordIds:
        rule.ruleType === "KEYWORD"
          ? Array.isArray(rule.value)
            ? rule.value
                .map(val => Number(val))
                .filter(val => !Number.isNaN(val))
            : []
          : [],
      values:
        rule.ruleType === "KEYWORD"
          ? ""
          : Array.isArray(rule.value)
            ? rule.value.join(", ")
            : typeof rule.value === "string"
              ? rule.value
              : "",
    })),
  };
}

export default function SegmentsPage() {
  const { data: segments = [], isLoading } = useSegments();
  const createMutation = useCreateSegment();
  const updateMutation = useUpdateSegment();
  const deleteMutation = useDeleteSegment();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);

  const modalTitle = editingSegment ? "Edit Segment" : "New Segment";

  const initialFormValues = useMemo(() => {
    if (!editingSegment) return undefined;
    return transformSegmentToFormValues(editingSegment);
  }, [editingSegment]);

  const handleCreateClick = () => {
    setEditingSegment(null);
    setModalOpen(true);
  };

  const handleEditClick = (segment: Segment) => {
    setEditingSegment(segment);
    setModalOpen(true);
  };

  const handlePreview = async (segmentId: number) => {
    try {
      const result = await segmentService.resolve(segmentId, 20);
      toast.success(`Found ${result.total} contacts`, {
        description: `${Math.min(result.contacts.length, 20)} sample contacts fetched`,
      });
    } catch (error) {
      toast.error("Failed to resolve segment", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
    }
  };

  const handleDelete = async (segmentId: number) => {
    if (!confirm("Delete this segment?")) return;
    try {
      await deleteMutation.mutateAsync(segmentId);
      toast.success("Segment deleted");
    } catch (error) {
      toast.error("Failed to delete segment", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
    }
  };

  const handleSave = async (payload: SegmentPayload) => {
    if (editingSegment) {
      await updateMutation.mutateAsync({ id: editingSegment.id, payload });
      toast.success("Segment updated");
    } else {
      await createMutation.mutateAsync(payload);
      toast.success("Segment created");
    }
  };

  return (
    <PageShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base sm:text-lg font-semibold tracking-tight">
            Segments
          </h1>
          <p className="text-muted-foreground">
            Define reusable audiences for WhatsApp campaigns
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={handleCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          New Segment
        </Button>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[13.75rem]">Name</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead>Logic</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    Loading segments...
                  </div>
                </TableCell>
              </TableRow>
            ) : segments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-10 text-muted-foreground"
                >
                  No segments yet. Create your first segment to start targeting
                  campaigns.
                </TableCell>
              </TableRow>
            ) : (
              segments.map(segment => (
                <TableRow key={segment.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{segment.name}</span>
                      {segment.description && (
                        <span className="text-xs text-muted-foreground">
                          {segment.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground">
                      {getRuleSummary(segment)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{segment.logicOperator}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(segment.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePreview(segment.id)}
                      title="Preview"
                      aria-label={`Preview ${segment.name}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(segment)}
                      title="Edit"
                      aria-label={`Edit ${segment.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(segment.id)}
                      title="Delete"
                      aria-label={`Delete ${segment.name}`}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <SegmentFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialValues={initialFormValues}
        onSubmit={handleSave}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        title={modalTitle}
      />
    </PageShell>
  );
}
