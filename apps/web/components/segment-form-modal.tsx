"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Card } from "@repo/ui/components/ui/card";
import { X } from "@repo/ui/icons";
import { KeywordSelect } from "./keyword-select";
import {
  SegmentPayload,
  SegmentRuleType,
  SegmentRuleOperator,
} from "../lib/api/types";

type RuleState = {
  id: string;
  ruleType: SegmentRuleType;
  operator: SegmentRuleOperator;
  keywordIds: number[];
  values: string;
};

export type SegmentFormValues = {
  name: string;
  description?: string;
  logicOperator: "AND" | "OR";
  rules: RuleState[];
};

interface SegmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: SegmentFormValues;
  onSubmit: (payload: SegmentPayload) => Promise<void>;
  isSubmitting?: boolean;
  title?: string;
}

const generateId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const emptyRule = (): RuleState => ({
  id: generateId(),
  ruleType: "KEYWORD",
  operator: "IN",
  keywordIds: [],
  values: "",
});

export function SegmentFormModal({
  open,
  onOpenChange,
  initialValues,
  onSubmit,
  isSubmitting = false,
  title = "New Segment",
}: SegmentFormModalProps) {
  const [values, setValues] = React.useState<SegmentFormValues>(
    initialValues ?? {
      name: "",
      description: "",
      logicOperator: "AND",
      rules: [emptyRule()],
    }
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && initialValues) {
      setValues(initialValues);
    } else if (open && !initialValues) {
      setValues({
        name: "",
        description: "",
        logicOperator: "AND",
        rules: [emptyRule()],
      });
    }
  }, [open, initialValues]);

  const updateRule = (ruleId: string, updater: Partial<RuleState>) => {
    setValues(prev => ({
      ...prev,
      rules: prev.rules.map(rule =>
        rule.id === ruleId ? { ...rule, ...updater } : rule
      ),
    }));
  };

  const addRule = () => {
    setValues(prev => ({ ...prev, rules: [...prev.rules, emptyRule()] }));
  };

  const removeRule = (ruleId: string) => {
    setValues(prev => ({
      ...prev,
      rules:
        prev.rules.length > 1
          ? prev.rules.filter(rule => rule.id !== ruleId)
          : prev.rules,
    }));
  };

  const handleSubmit = async () => {
    if (!values.name.trim()) return;
    setSaving(true);
    try {
      const payload: SegmentPayload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        logicOperator: values.logicOperator,
        rules: values.rules
          .filter(rule => {
            if (rule.ruleType === "KEYWORD") {
              return rule.keywordIds.length > 0;
            }
            return rule.values.trim().length > 0;
          })
          .map(rule => ({
            ruleType: rule.ruleType,
            operator: rule.operator,
            value:
              rule.ruleType === "KEYWORD"
                ? rule.keywordIds
                : rule.values
                    .split(",")
                    .map(token => token.trim())
                    .filter(Boolean),
          })),
      };

      await onSubmit(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const DialogContentAny = DialogContent as React.ComponentType<
    React.ComponentProps<typeof DialogContent>
  >;
  const DialogHeaderAny = DialogHeader as React.ComponentType<
    React.ComponentProps<typeof DialogHeader>
  >;
  const DialogTitleAny = DialogTitle as React.ComponentType<
    React.ComponentProps<typeof DialogTitle>
  >;
  const DialogFooterAny = DialogFooter as React.ComponentType<
    React.ComponentProps<typeof DialogFooter>
  >;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentAny className="max-w-3xl">
        <DialogHeaderAny>
          <DialogTitleAny>{title}</DialogTitleAny>
        </DialogHeaderAny>
        <div className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Segment Name</Label>
              <Input
                value={values.name}
                onChange={e =>
                  setValues(prev => ({ ...prev, name: e.target.value }))
                }
                placeholder="High intent Mumbai leads"
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={values.description || ""}
                onChange={e =>
                  setValues(prev => ({ ...prev, description: e.target.value }))
                }
                rows={3}
                placeholder="Internal notes about this segment"
              />
            </div>
            <div className="grid gap-2">
              <Label>Match Logic</Label>
              <Select
                value={values.logicOperator}
                onValueChange={val =>
                  setValues(prev => ({
                    ...prev,
                    logicOperator: val as "AND" | "OR",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select logic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">All rules must match</SelectItem>
                  <SelectItem value="OR">Any rule can match</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Rules</Label>
                <p className="text-sm text-muted-foreground">
                  Add keyword or location filters
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addRule}>
                Add Rule
              </Button>
            </div>

            <div className="space-y-4">
              {values.rules.map(rule => (
                <Card key={rule.id} className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:flex">
                      <div className="w-full lg:w-40">
                        <Label>Rule Type</Label>
                        <Select
                          value={rule.ruleType}
                          onValueChange={val =>
                            updateRule(rule.id, {
                              ruleType: val as SegmentRuleType,
                              keywordIds: [],
                              values: "",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="KEYWORD">Keyword</SelectItem>
                            <SelectItem value="CITY">City</SelectItem>
                            <SelectItem value="STATE">State</SelectItem>
                            <SelectItem value="PINCODE">Pincode</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full lg:w-32">
                        <Label>Operator</Label>
                        <Select
                          value={rule.operator}
                          onValueChange={val =>
                            updateRule(rule.id, {
                              operator: val as SegmentRuleOperator,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IN">Matches</SelectItem>
                            <SelectItem value="NOT_IN">
                              Does not match
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {values.rules.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRule(rule.id)}
                        aria-label="Remove rule"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {rule.ruleType === "KEYWORD" ? (
                    <KeywordSelect
                      selectedKeywordIds={rule.keywordIds}
                      onSelectionChange={ids =>
                        updateRule(rule.id, { keywordIds: ids })
                      }
                      label="Keywords"
                    />
                  ) : (
                    <div className="grid gap-2">
                      <Label>
                        Values{" "}
                        <span className="text-xs text-muted-foreground">
                          Enter comma-separated values
                        </span>
                      </Label>
                      <Input
                        value={rule.values}
                        onChange={e =>
                          updateRule(rule.id, { values: e.target.value })
                        }
                        placeholder={
                          rule.ruleType === "CITY"
                            ? "Mumbai, Delhi"
                            : rule.ruleType === "STATE"
                              ? "Maharashtra, Karnataka"
                              : "400001, 560001"
                        }
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </div>
        <DialogFooterAny className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || isSubmitting}>
            {saving || isSubmitting ? "Saving..." : "Save segment"}
          </Button>
        </DialogFooterAny>
      </DialogContentAny>
    </Dialog>
  );
}
