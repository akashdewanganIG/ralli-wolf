"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import {
  LEAD_SOURCES,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_TYPES,
} from "./opportunity-enums";
import { useCreateOpportunity } from "@/hooks/use-opportunities";
import { accountService } from "@/lib/api/services";
import type { Account } from "@/lib/api/types";

type CreateOpportunityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (opportunity: any) => void;
};

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CreateOpportunityDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOpportunityDialogProps) {
  const [name, setName] = React.useState("");
  const [accountId, setAccountId] = React.useState<number | null>(null);
  const [accountSearch, setAccountSearch] = React.useState("");
  const [accountResults, setAccountResults] = React.useState<Account[]>([]);
  const [selectedAccountName, setSelectedAccountName] = React.useState("");
  const [showAccountResults, setShowAccountResults] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);

  const [stage, setStage] = React.useState<string>("PROSPECT");
  const [closeDate, setCloseDate] = React.useState<string>(todayPlus(30));
  const [type, setType] = React.useState<string>("");
  const [leadSource, setLeadSource] = React.useState<string>("");
  const [description, setDescription] = React.useState("");
  const [showErrors, setShowErrors] = React.useState(false);

  const createMutation = useCreateOpportunity();
  const accountSearchRef = React.useRef<HTMLDivElement>(null);

  const reset = React.useCallback(() => {
    setName("");
    setAccountId(null);
    setAccountSearch("");
    setAccountResults([]);
    setSelectedAccountName("");
    setShowAccountResults(false);

    setStage("PROSPECT");
    setCloseDate(todayPlus(30));
    setType("");
    setLeadSource("");
    setDescription("");
    setShowErrors(false);
  }, []);

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  React.useEffect(() => {
    if (accountSearch.trim().length < 2) {
      setAccountResults([]);
      setShowAccountResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await accountService.searchAccounts(
          accountSearch.trim()
        );
        setAccountResults(results);
        setShowAccountResults(true);
      } catch {
        setAccountResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [accountSearch]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        accountSearchRef.current &&
        !accountSearchRef.current.contains(e.target as Node)
      ) {
        setShowAccountResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectAccount = (account: Account) => {
    setAccountId(account.id);
    setSelectedAccountName(account.name);
    setAccountSearch(account.name);
    setShowAccountResults(false);
  };

  const handleAccountInputChange = (value: string) => {
    setAccountSearch(value);

    if (selectedAccountName && value !== selectedAccountName) {
      setAccountId(null);
      setSelectedAccountName("");
    }
  };

  const canCreate = name.trim().length > 0 && !!accountId && !!closeDate;

  const handleCreate = () => {
    if (!canCreate) {
      setShowErrors(true);
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        accountId: accountId!,

        stage: stage || undefined,
        expectedCloseDate: closeDate || undefined,
        type: type || undefined,
        leadSource: leadSource || undefined,
        description: description || undefined,
      },
      {
        onSuccess: response => {
          onOpenChange(false);
          onSuccess?.(response.data);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create Opportunity</DialogTitle>
          <DialogDescription>
            Fill the details below to create a new opportunity.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>
                Opportunity Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter opportunity name"
              />
              {showErrors && !name.trim() && (
                <p className="text-xs text-destructive">
                  Opportunity name is required
                </p>
              )}
            </div>

            <div className="space-y-2 relative" ref={accountSearchRef}>
              <Label>
                Account Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={accountSearch}
                onChange={e => handleAccountInputChange(e.target.value)}
                onFocus={() => {
                  if (accountResults.length > 0 && !accountId)
                    setShowAccountResults(true);
                }}
                placeholder="Search account name..."
                autoComplete="off"
              />
              {isSearching && (
                <p className="text-xs text-muted-foreground mt-1">
                  Searching...
                </p>
              )}
              {showAccountResults && accountResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto overflow-x-auto rounded-md border border-border bg-surface shadow-lg">
                  {accountResults.map(account => (
                    <button
                      key={account.id}
                      type="button"
                      className="flex w-full items-center whitespace-nowrap px-3 py-2 text-left text-sm hover:bg-surface-secondary cursor-pointer transition-colors"
                      onClick={() => handleSelectAccount(account)}
                    >
                      {account.name}
                    </button>
                  ))}
                </div>
              )}
              {showAccountResults &&
                accountResults.length === 0 &&
                accountSearch.trim().length >= 2 &&
                !isSearching && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-surface shadow-lg">
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      No accounts found
                    </p>
                  </div>
                )}
              {showErrors && !accountId && (
                <p className="text-xs text-destructive">
                  Account name is required
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {OPPORTUNITY_STAGES.map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Close Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={closeDate}
                onChange={e => setCloseDate(e.target.value)}
              />
              {showErrors && !closeDate && (
                <p className="text-xs text-destructive">
                  Close date is required
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {OPPORTUNITY_TYPES.map(t => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Lead Source</Label>
              <Select value={leadSource} onValueChange={setLeadSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Select lead source" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map(ls => (
                    <SelectItem key={ls} value={ls}>
                      {ls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter description"
                className="min-h-[6.875rem]"
              />
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
