"use client";

import * as React from "react";
import {
  Button,
  Dialog,
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
import type { Quote, QuoteLineItem } from "./quote-types";
import { DUMMY_PRICEBOOKS, DUMMY_PRODUCTS } from "./quote-dummy-data";

type AddLineItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote;
  existingCount: number;
  onCreate: (item: QuoteLineItem) => void;
};

function makeId() {
  return `qli_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function AddLineItemDialog({
  open,
  onOpenChange,
  quote,
  existingCount,
  onCreate,
}: AddLineItemDialogProps) {
  const nextNumber = existingCount + 1;
  const lineName = `${quote.quoteNumber}-${String(nextNumber).padStart(2, "0")}`;

  const [number, setNumber] = React.useState<number>(nextNumber);
  const [productId, setProductId] = React.useState<string>("");
  const [listUnitPrice, setListUnitPrice] = React.useState<number>(0);
  const [quantity, setQuantity] = React.useState<number>(1);
  const [pricebookId, setPricebookId] = React.useState<string>("");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setNumber(nextNumber);
      setProductId("");
      setListUnitPrice(0);
      setQuantity(1);
      setPricebookId("");
      setDescription("");
    }
  }, [open, nextNumber]);

  const netPrice = listUnitPrice * quantity;
  const canCreate = productId.length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    const product = DUMMY_PRODUCTS.find(p => String(p.id) === productId);
    const pb = DUMMY_PRICEBOOKS.find(p => String(p.id) === pricebookId);
    const now = nowIso();
    onCreate({
      id: makeId(),
      quoteId: quote.id,
      lineName,
      number,
      productId: Number(productId),
      productName: product?.name || "Product",
      listUnitPrice,
      quantity,
      netPrice,
      description: description || undefined,
      pricebookId: pb?.id,
      pricebookName: pb?.name,
      createdBy: "Sales Rep",
      createdAt: now,
      lastModifiedBy: "Sales Rep",
      lastModifiedAt: now,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Line Item</DialogTitle>
          <DialogDescription>Dummy frontend data only.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Line Name</Label>
            <Input value={lineName} disabled />
          </div>
          <div className="space-y-2">
            <Label>Number</Label>
            <Input
              type="number"
              value={number}
              onChange={e => setNumber(Number(e.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {DUMMY_PRODUCTS.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pricebook</Label>
            <Select value={pricebookId} onValueChange={setPricebookId}>
              <SelectTrigger>
                <SelectValue placeholder="Select pricebook" />
              </SelectTrigger>
              <SelectContent>
                {DUMMY_PRICEBOOKS.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>List Unit Price</Label>
            <Input
              type="number"
              value={listUnitPrice}
              onChange={e => setListUnitPrice(Number(e.target.value || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value || 0))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Net Price</Label>
            <Input value={String(netPrice)} disabled />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="min-h-[6.25rem]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
