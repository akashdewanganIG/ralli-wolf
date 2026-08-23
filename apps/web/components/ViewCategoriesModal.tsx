"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { ProductCategory } from "@/lib/api/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ProductCategory[];
};

export const ViewCategoriesModal: React.FC<Props> = ({
  open,
  onOpenChange,
  categories,
}) => {
  const DialogContentAny = DialogContent as any;
  const DialogHeaderAny = DialogHeader as any;
  const DialogTitleAny = DialogTitle as any;
  const DialogDescriptionAny = DialogDescription as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentAny className="sm:max-w-[37.5rem]">
        <DialogHeaderAny>
          <DialogTitleAny>All Categories</DialogTitleAny>
          <DialogDescriptionAny>
            Here is a list of all the product categories.
          </DialogDescriptionAny>
        </DialogHeaderAny>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(category => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContentAny>
    </Dialog>
  );
};
