"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
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
import React, { useEffect, useMemo, useState } from "react";
import { useCreatePricebookEntry } from "../hooks/use-pricebook-entries";
import { usePricebooks } from "../hooks/use-pricebooks";
import { PriceBookEntry } from "../lib/api/types";
import { toast } from "../lib/toast";
import { AddPricebookModal } from "./add-pricebook-modal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  pricebookEntries: PriceBookEntry[];
};

type FormState = {
  pricebookId: string;
  listPrice: string;
  isActive: boolean;
  useStandardPrice: boolean;
};

export const AddPricebookEntryModal: React.FC<Props> = ({
  open,
  onOpenChange,
  productId,
  pricebookEntries,
}) => {
  const [form, setForm] = useState<FormState>({
    pricebookId: "",
    listPrice: "",
    isActive: true,
    useStandardPrice: false,
  });

  const [showAddPricebookModal, setShowAddPricebookModal] = useState(false);

  const { data: pricebooksData, isLoading: pricebooksLoading } =
    usePricebooks();
  const createPricebookEntry = useCreatePricebookEntry();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const standardPriceBook = useMemo(
    () => pricebooksData?.data.find(pb => pb.name === "Standard Price Book"),
    [pricebooksData]
  );

  const hasStandardPriceBookEntry = useMemo(() => {
    if (!standardPriceBook || !pricebookEntries) {
      return false;
    }
    return pricebookEntries.some(
      entry => entry.priceBookId === standardPriceBook.id
    );
  }, [pricebookEntries, standardPriceBook]);

  useEffect(() => {
    if (form.useStandardPrice && standardPriceBook) {
      setForm(prev => ({ ...prev, pricebookId: String(standardPriceBook.id) }));
    }
  }, [form.useStandardPrice, standardPriceBook]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.pricebookId) {
      e.pricebookId = "Price book is required.";
    } else if (!form.useStandardPrice && !hasStandardPriceBookEntry) {
      e.pricebookId =
        "A standard price must be set for this product before adding other price book entries.";
    } else {
      const isDuplicate = pricebookEntries.some(
        entry => entry.priceBookId === Number(form.pricebookId)
      );
      if (isDuplicate) {
        e.pricebookId = "This product is already in the selected price book.";
      }
    }
    if (
      !form.listPrice ||
      isNaN(Number(form.listPrice)) ||
      Number(form.listPrice) <= 0
    ) {
      e.listPrice = "A valid price is required.";
    }
    return e;
  }, [form, hasStandardPriceBookEntry, pricebookEntries]);

  const hasErrors = Object.keys(errors).length > 0;

  const shouldShowError = (fieldName: string) => {
    return touched.has(fieldName) || submitAttempted;
  };

  const update =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }));
    };

  const updateChecked = (key: keyof FormState) => (checked: boolean) => {
    setForm(prev => ({ ...prev, [key]: checked }));
    if (key === "useStandardPrice" && !checked) {
      setForm(prev => ({ ...prev, pricebookId: "" }));
    }
  };

  const markTouched = (fieldName: string) => {
    setTouched(prev => new Set(prev).add(fieldName));
  };

  const resetAndClose = () => {
    setForm({
      pricebookId: "",
      listPrice: "",
      isActive: true,
      useStandardPrice: false,
    });
    setTouched(new Set());
    setSubmitAttempted(false);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (hasErrors) return;
    try {
      setSubmitError(null);
      await createPricebookEntry.mutateAsync({
        priceBookId: Number(form.pricebookId),
        productId: productId,
        listPrice: Number(form.listPrice),
        isActive: form.isActive,
        useStandardPrice: form.useStandardPrice,
      });
      toast.success("Price book entry created successfully");
      resetAndClose();
    } catch (err) {
      toast.error(err, "Failed to create price book entry");
      const message =
        (err as any)?.message || "Failed to create price book entry";
      setSubmitError(message);
    }
  };

  const handlePricebookChange = (value: string) => {
    if (value === "add-new") {
      setShowAddPricebookModal(true);
    } else {
      setForm(prev => ({ ...prev, pricebookId: value }));
    }
  };

  const DialogContentAny = DialogContent as any;
  const DialogHeaderAny = DialogHeader as any;
  const DialogFooterAny = DialogFooter as any;
  const DialogTitleAny = DialogTitle as any;
  const DialogDescriptionAny = DialogDescription as any;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContentAny className="gap-0 overflow-hidden sm:max-w-[30rem]">
          <DialogHeaderAny className="text-center">
            <DialogTitleAny className="text-center">
              Add Price Book Entry
            </DialogTitleAny>
            <DialogDescriptionAny className="text-center">
              Add a new price for this product in a price book. Fields marked
              with <span className="text-destructive">*</span> are required.
            </DialogDescriptionAny>
          </DialogHeaderAny>
          <DialogBody>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useStandardPrice"
                  checked={form.useStandardPrice}
                  onCheckedChange={updateChecked("useStandardPrice")}
                />
                <label
                  htmlFor="useStandardPrice"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Use Standard Price
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pricebookId">
                  Price Book<span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.pricebookId}
                  onValueChange={handlePricebookChange}
                  disabled={form.useStandardPrice}
                >
                  <SelectTrigger onBlur={() => markTouched("pricebookId")}>
                    <SelectValue placeholder="Select a price book" />
                  </SelectTrigger>
                  <SelectContent>
                    {pricebooksLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading...
                      </SelectItem>
                    ) : (
                      <>
                        {pricebooksData?.data.map(pb => (
                          <SelectItem key={pb.id} value={String(pb.id)}>
                            {pb.name}
                          </SelectItem>
                        ))}
                        <SelectItem
                          value="add-new"
                          className="text-info-foreground"
                        >
                          + Add new price book
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {shouldShowError("pricebookId") && errors.pricebookId && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.pricebookId}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="listPrice">
                  List Price<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="listPrice"
                  type="number"
                  value={form.listPrice}
                  onChange={update("listPrice")}
                  onBlur={() => markTouched("listPrice")}
                  placeholder="e.g. 99.99"
                  aria-invalid={
                    shouldShowError("listPrice") && !!errors.listPrice
                  }
                />
                {shouldShowError("listPrice") && errors.listPrice && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.listPrice}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={updateChecked("isActive")}
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Is Active
                </label>
              </div>
            </div>
          </DialogBody>
          <DialogFooterAny>
            {submitError && (
              <p className="text-sm text-destructive mr-auto" role="alert">
                {submitError}
              </p>
            )}
            <Button
              variant="outline"
              onClick={resetAndClose}
              disabled={createPricebookEntry.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createPricebookEntry.isPending || (submitAttempted && hasErrors)
              }
            >
              {createPricebookEntry.isPending ? "Adding..." : "Add Entry"}
            </Button>
          </DialogFooterAny>
        </DialogContentAny>
      </Dialog>
      <AddPricebookModal
        open={showAddPricebookModal}
        onOpenChange={setShowAddPricebookModal}
      />
    </>
  );
};

export default AddPricebookEntryModal;
