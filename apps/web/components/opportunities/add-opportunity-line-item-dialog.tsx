"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SearchableSelect,
} from "@repo/ui";
import type { SearchableSelectItem } from "@repo/ui";
import { useAddOpportunityLineItem } from "@/hooks/useOpportunities";
import { usePricebookEntriesByPriceBookId } from "@/hooks/usePricebookEntries";
import { useActiveProducts } from "@/hooks/useProducts";
import { toast } from "@/lib/toast";

type AddOpportunityLineItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: number;
  priceBook?: { id: number; name: string } | null;
};

export function AddOpportunityLineItemDialog({
  open,
  onOpenChange,
  opportunityId,
  priceBook,
}: AddOpportunityLineItemDialogProps) {
  const addLineItem = useAddOpportunityLineItem();

  // Fetch pricebook entries when a pricebook is selected, otherwise fall back to all active products
  const { data: entriesResponse, isLoading: entriesLoading } =
    usePricebookEntriesByPriceBookId({ priceBookId: priceBook?.id ?? 0 });
  const { data: allProducts = [], isLoading: productsLoading } =
    useActiveProducts();

  const entries = entriesResponse?.data ?? [];
  const isLoading = priceBook ? entriesLoading : productsLoading;

  const [productId, setProductId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [listPrice, setListPrice] = React.useState(0);
  const [discount, setDiscount] = React.useState(0);

  // Reset all fields when dialog closes
  React.useEffect(() => {
    if (!open) {
      setProductId("");
      setQuantity(1);
      setListPrice(0);
      setDiscount(0);
    }
  }, [open]);

  // Auto-fill list price from the selected product/entry
  React.useEffect(() => {
    if (!productId) return;
    if (priceBook) {
      const entry = entries.find(e => String(e.productId) === productId);
      if (entry) setListPrice(Number(entry.listPrice) || 0);
    } else {
      const product = allProducts.find(p => String(p.id) === productId);
      if (product) setListPrice(Number(product.price) || 0);
    }
  }, [productId, priceBook, entries, allProducts]);

  // Build items for SearchableSelect
  const selectItems: SearchableSelectItem[] = priceBook
    ? entries.map(e => ({
        value: String(e.productId),
        label: e.product?.name ?? `Product #${e.productId}`,
        searchText: e.product?.name ?? "",
      }))
    : allProducts.map(p => ({
        value: String(p.id),
        label: p.name,
        searchText: p.name,
      }));

  const unitPrice = listPrice * (1 - discount / 100);
  const totalPrice = quantity * unitPrice;
  const canSubmit = productId.length > 0 && quantity > 0 && listPrice >= 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    addLineItem.mutate(
      {
        opportunityId,
        data: {
          productId: Number(productId),
          quantity,
          listPrice,
          discount,
          description: null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Line item added successfully");
          onOpenChange(false);
        },
        onError: error => {
          toast.error(error, "Failed to add line item");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Line Item</DialogTitle>
          {priceBook && (
            <p className="text-xs text-muted-foreground pt-1">
              Products are from the selected price book:{" "}
              <span className="font-medium text-foreground">
                {priceBook.name}
              </span>
            </p>
          )}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-1.5">
            <Label>Product</Label>
            <SearchableSelect
              value={productId}
              onValueChange={setProductId}
              items={selectItems}
              placeholder={
                isLoading ? "Loading products..." : "Select a product"
              }
              searchPlaceholder="Search products..."
              emptyText="No products found."
              disabled={isLoading}
              triggerClassName="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
              onFocus={e => e.target.select()}
            />
          </div>

          <div className="space-y-1.5">
            <Label>List Price ($)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={listPrice}
              onChange={e => setListPrice(Number(e.target.value))}
              onFocus={e => e.target.select()}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Discount (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={discount}
              onChange={e =>
                setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))
              }
              onFocus={e => e.target.select()}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Unit Price ($)</Label>
            <Input value={unitPrice.toFixed(2)} disabled />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Total Price ($)</Label>
            <Input value={totalPrice.toFixed(2)} disabled />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addLineItem.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || addLineItem.isPending}
          >
            {addLineItem.isPending ? "Adding..." : "Add Line Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
