"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  DetailPageHeader,
  InfoField,
  InfoGrid,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import { useQuoteLineItemsStore } from "./use-quote-line-items-store";
import { useQuotesStore } from "./use-quotes-store";
import { DUMMY_PRICEBOOKS, DUMMY_PRODUCTS } from "./quote-dummy-data";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { formatMoney } from "@/lib/utils/decimal";

type QuoteLineItemDetailPageProps = {
  quoteId: string;
  lineItemId: string;
};

function formatDateTime(iso: string) {
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

export function QuoteLineItemDetailPage({
  quoteId,
  lineItemId,
}: QuoteLineItemDetailPageProps) {
  const router = useRouter();
  const { isReady: quotesReady, getById: getQuoteById } = useQuotesStore();
  const {
    isReady: lineItemsReady,
    getById: getLineItemById,
    updateLineItem,
  } = useQuoteLineItemsStore();

  const quote = getQuoteById(quoteId);
  const lineItem = getLineItemById(lineItemId);
  const [isEditing, setIsEditing] = React.useState(false);

  const [number, setNumber] = React.useState(0);
  const [quantity, setQuantity] = React.useState(1);
  const [productId, setProductId] = React.useState("");
  const [pricebookId, setPricebookId] = React.useState("");
  const [listUnitPrice, setListUnitPrice] = React.useState(0);
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (!lineItem) return;
    setNumber(lineItem.number);
    setQuantity(lineItem.quantity);
    setProductId(String(lineItem.productId));
    setPricebookId(lineItem.pricebookId ? String(lineItem.pricebookId) : "");
    setListUnitPrice(lineItem.listUnitPrice);
    setDescription(lineItem.description || "");
  }, [lineItem]);

  const netPrice = listUnitPrice * quantity;

  if (!quotesReady || !lineItemsReady) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading line item...
      </div>
    );
  }

  if (!quote || !lineItem || lineItem.quoteId !== quote.id) {
    return (
      <PageShell>
        <div className="text-lg font-semibold">Line item not found</div>
        <Button
          variant="outline"
          onClick={() => router.push(`/sales/quotes/${quoteId}`)}
        >
          Back to Quote
        </Button>
      </PageShell>
    );
  }

  const handleSave = () => {
    const product = DUMMY_PRODUCTS.find(p => String(p.id) === productId);
    const pb = DUMMY_PRICEBOOKS.find(p => String(p.id) === pricebookId);
    updateLineItem(lineItem.id, {
      number,
      quantity,
      productId: Number(productId),
      productName: product?.name || lineItem.productName,
      pricebookId: pb?.id,
      pricebookName: pb?.name,
      listUnitPrice,
      netPrice,
      description,
      lastModifiedBy: "Sales Rep",
      lastModifiedAt: new Date().toISOString(),
    });
    setIsEditing(false);
  };

  return (
    <PageShell>
      <DetailPageHeader
        title={lineItem.lineName}
        onBack={() => router.push(`/sales/quotes/${quoteId}`)}
        actions={[
          {
            label: isEditing ? "Cancel" : "Edit",
            onClick: () => setIsEditing(prev => !prev),
            variant: "outline",
          },
        ]}
      />

      <Card className="border shadow-sm">
        <CardContent className="p-4 space-y-4">
          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Line Number</Label>
                <Input value={lineItem.lineName} disabled />
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
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value || 0))}
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
              <div className="space-y-2 md:col-span-2">
                <Label>Net Price</Label>
                <Input value={String(netPrice)} disabled />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </div>
            </div>
          ) : (
            <InfoGrid columns={2}>
              <InfoField label="Line Number" value={lineItem.lineName} />
              <InfoField label="Number" value={String(lineItem.number)} />
              <InfoField label="Quantity" value={String(lineItem.quantity)} />
              <InfoField label="Product" value={lineItem.productName} />
              <InfoField
                label="Pricebook"
                value={lineItem.pricebookName || "N/A"}
              />
              <InfoField
                label="List Unit Price"
                value={formatMoney(lineItem.listUnitPrice)}
              />
              <InfoField
                label="Net Price"
                value={formatMoney(lineItem.netPrice)}
              />
              <InfoField label="Created By" value={lineItem.createdBy} />
              <InfoField
                label="Created At"
                value={formatDateTime(lineItem.createdAt)}
              />
              <InfoField
                label="Last Modified By"
                value={lineItem.lastModifiedBy}
              />
              <InfoField
                label="Last Modified At"
                value={formatDateTime(lineItem.lastModifiedAt)}
              />
            </InfoGrid>
          )}

          {!isEditing && (
            <div>
              <Label>Description</Label>
              <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                {lineItem.description || "N/A"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
