"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";
import { AlertTriangle, ArrowRightLeft, Trash2 } from "@repo/ui/icons";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  icon?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  icon,
  isLoading = false,
  disabled = false,
}: ConfirmationDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const busy = isProcessing || isLoading;

  const handleConfirm = async () => {
    if (busy || disabled) return;

    setIsProcessing(true);
    try {
      await onConfirm();
      // Only close dialog if onConfirm doesn't throw an error
      onOpenChange(false);
    } catch {
      // Error handling is done in the parent component
      // Don't close the dialog on error
    } finally {
      setIsProcessing(false);
    }
  };

  const defaultIcon =
    variant === "destructive" ? (
      <AlertTriangle className="h-6 w-6 text-destructive" />
    ) : (
      <ArrowRightLeft className="h-6 w-6 text-primary" />
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[26.5625rem]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {icon || defaultIcon}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy || disabled}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={busy || disabled}
          >
            {busy ? "Processing…" : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Specific components for common actions
interface ConvertConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  itemName: string;
  itemType: "lead" | "contact" | "account";
}

export function ConvertConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  itemType,
}: ConvertConfirmationDialogProps) {
  const getTitle = () => {
    switch (itemType) {
      case "lead":
        return "Convert Lead";
      case "contact":
        return "Convert Contact";
      case "account":
        return "Convert Account";
      default:
        return "Convert Item";
    }
  };

  const getDescription = () => {
    switch (itemType) {
      case "lead":
        return `Are you sure you want to convert "${itemName}" from a lead to an opportunity? This action will create a new opportunity record.`;
      case "contact":
        return `Are you sure you want to convert "${itemName}" from a contact to a customer? This action will update their status.`;
      case "account":
        return `Are you sure you want to convert "${itemName}" from an account to a customer account? This action will update their status.`;
      default:
        return `Are you sure you want to convert "${itemName}"?`;
    }
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={getTitle()}
      description={getDescription()}
      confirmText="Convert"
      cancelText="Cancel"
      variant="default"
      icon={<ArrowRightLeft className="h-6 w-6 text-primary" />}
    />
  );
}

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  itemName: string;
  itemType: "lead" | "contact" | "account" | "opportunity";
  isLoading?: boolean;
  disabled?: boolean;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  itemType,
  isLoading = false,
  disabled = false,
}: DeleteConfirmationDialogProps) {
  const getTitle = () => {
    switch (itemType) {
      case "lead":
        return "Delete Lead";
      case "contact":
        return "Delete Contact";
      case "account":
        return "Delete Account";
      case "opportunity":
        return "Delete Opportunity";
      default:
        return "Delete Item";
    }
  };

  const getDescription = () => {
    switch (itemType) {
      case "lead":
        return `Are you sure you want to delete "${itemName}"? This action cannot be undone and will permanently remove the lead and all associated data.`;
      case "contact":
        return `Are you sure you want to delete "${itemName}"? This action cannot be undone and will permanently remove the contact and all associated data.`;
      case "account":
        return `Are you sure you want to delete "${itemName}"? This action cannot be undone and will permanently remove the account and all associated data.`;
      case "opportunity":
        return `Are you sure you want to delete "${itemName}"?`;
      default:
        return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
    }
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={getTitle()}
      description={getDescription()}
      confirmText="Delete"
      cancelText="Cancel"
      variant="destructive"
      icon={<Trash2 className="h-6 w-6 text-destructive" />}
      isLoading={isLoading}
      disabled={disabled}
    />
  );
}
