"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import React, { useEffect, useMemo, useState } from "react";
// NOTE: If types across packages conflict, we use local any aliases to unblock build
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useLeadManagementContext } from "../contexts/LeadManagementContext";
import { useCreateLead } from "../hooks/useLeads";
import type { LeadSource } from "../lib/api/types";
import { toast } from "../lib/toast";
import {
  validateEmail,
  validateFieldLength,
  validateName,
  validatePhone,
  validatePincode,
} from "../lib/validation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  city: string;
  state: string;
  pincode: string;
  status:
    | "OPEN"
    | "WORKING"
    | "QUALIFIED"
    | "UNQUALIFIED"
    | "NURTURING"
    | "CONVERTED";
  source: LeadSource;
};

export const AddLeadModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { setCurrentPage } = useLeadManagementContext();
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    city: "",
    state: "",
    pincode: "",
    status: "OPEN",
    source: "MANUAL",
  });

  const createLead = useCreateLead();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!open) {
      setTouched(new Set());
      setSubmitAttempted(false);
    }
  }, [open]);

  // Detect autofill by checking if values exist but fields aren't marked as touched
  useEffect(() => {
    if (open && !submitAttempted) {
      const timers: NodeJS.Timeout[] = [];
      const fieldsToCheck: (keyof FormState)[] = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "companyName",
        "city",
        "state",
        "pincode",
      ];
      fieldsToCheck.forEach(field => {
        if (form[field] && !touched.has(field)) {
          // Small delay to ensure autofill has completed
          const timer = setTimeout(() => {
            if (form[field]) {
              markTouched(field);
            }
          }, 100);
          timers.push(timer);
        }
      });
      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }
  }, [form, open, submitAttempted, touched]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};

    // Validate first name
    const firstNameValidation = validateName(form.firstName);
    if (!firstNameValidation.isValid) {
      e.firstName = firstNameValidation.error;
    }

    if (form.lastName.trim()) {
      const lastNameValidation = validateName(form.lastName);
      if (!lastNameValidation.isValid) {
        e.lastName = lastNameValidation.error;
      }
    }

    // Validate email
    const emailValidation = validateEmail(form.email);
    if (!emailValidation.isValid) {
      e.email = emailValidation.error;
    }

    // Validate phone
    const phoneValidation = validatePhone(form.phone);
    if (!phoneValidation.isValid) {
      e.phone = phoneValidation.error;
    }

    // Validate pincode (optional)
    if (form.pincode.trim()) {
      const pincodeValidation = validatePincode(form.pincode);
      if (!pincodeValidation.isValid) {
        e.pincode = pincodeValidation.error;
      }
    }

    // Validate field lengths (optional fields)
    if (form.companyName.trim()) {
      const companyValidation = validateFieldLength(form.companyName, 255);
      if (!companyValidation.isValid) {
        e.companyName = companyValidation.error;
      }
    }

    if (form.city.trim()) {
      const cityValidation = validateFieldLength(form.city, 100);
      if (!cityValidation.isValid) {
        e.city = cityValidation.error;
      }
    }

    if (form.state.trim()) {
      const stateValidation = validateFieldLength(form.state, 100);
      if (!stateValidation.isValid) {
        e.state = stateValidation.error;
      }
    }

    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;

  const shouldShowError = (fieldName: string) => {
    return touched.has(fieldName) || submitAttempted;
  };

  const update =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }));
    };

  const markTouched = (fieldName: string) => {
    setTouched(prev => new Set(prev).add(fieldName));
  };

  // Handle autofill by listening to input events
  const handleInput =
    (key: keyof FormState) => (e: React.FormEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      setForm(prev => ({ ...prev, [key]: value }));
      // Mark as touched when autofill occurs
      if (value) {
        markTouched(key);
      }
    };

  const resetAndClose = () => {
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      companyName: "",
      city: "",
      state: "",
      pincode: "",
      status: "OPEN",
      source: "MANUAL",
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
      await createLead.mutateAsync({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim(),
        companyName: form.companyName.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        status: form.status,
        source: form.source,
      });
      toast.success("Lead created successfully");
      // Ensure the newly created lead is visible by resetting to page 1
      setCurrentPage(1);
      resetAndClose();
    } catch (err) {
      toast.error(err, "Failed to create lead");
      const message = (err as any)?.message || "Failed to create lead";
      setSubmitError(message);
    }
  };

  // Typed adapters to satisfy JSX component typing across packages
  const DialogContentAny = DialogContent as any;
  const DialogHeaderAny = DialogHeader as any;
  const DialogFooterAny = DialogFooter as any;
  const DialogTitleAny = DialogTitle as any;
  const DialogDescriptionAny = DialogDescription as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentAny className="sm:max-w-[720px]">
        <DialogHeaderAny className="text-center">
          <DialogTitleAny className="text-center">Add Lead</DialogTitleAny>
          <DialogDescriptionAny className="text-center">
            Create a new lead by providing basic contact and company details.
            Fields marked with <span className="text-red-500">*</span> are
            required.
          </DialogDescriptionAny>
        </DialogHeaderAny>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstName">
                First Name<span className="text-red-500">*</span>
              </Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={update("firstName")}
                onInput={handleInput("firstName")}
                onBlur={() => markTouched("firstName")}
                placeholder="Jane"
                autoFocus
                aria-invalid={
                  shouldShowError("firstName") && !!errors.firstName
                }
                aria-describedby={
                  shouldShowError("firstName") && errors.firstName
                    ? "firstName-error"
                    : undefined
                }
              />
              {shouldShowError("firstName") && errors.firstName && (
                <p id="firstName-error" className="text-xs text-red-600 mt-1">
                  {errors.firstName}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={update("lastName")}
                onInput={handleInput("lastName")}
                onBlur={() => markTouched("lastName")}
                placeholder="Doe"
                aria-invalid={shouldShowError("lastName") && !!errors.lastName}
                aria-describedby={
                  shouldShowError("lastName") && errors.lastName
                    ? "lastName-error"
                    : undefined
                }
              />
              {shouldShowError("lastName") && errors.lastName && (
                <p id="lastName-error" className="text-xs text-red-600 mt-1">
                  {errors.lastName}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">
                Email<span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={update("email")}
                onInput={handleInput("email")}
                onBlur={() => markTouched("email")}
                placeholder="jane@example.com"
                aria-invalid={shouldShowError("email") && !!errors.email}
                aria-describedby={
                  shouldShowError("email") && errors.email
                    ? "email-error"
                    : undefined
                }
              />
              {shouldShowError("email") && errors.email && (
                <p id="email-error" className="text-xs text-red-600 mt-1">
                  {errors.email}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">
                Phone<span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={update("phone")}
                onInput={handleInput("phone")}
                onBlur={() => markTouched("phone")}
                placeholder="+1 555 0100"
                aria-invalid={shouldShowError("phone") && !!errors.phone}
                aria-describedby={
                  shouldShowError("phone") && errors.phone
                    ? "phone-error"
                    : undefined
                }
              />
              {shouldShowError("phone") && errors.phone && (
                <p id="phone-error" className="text-xs text-red-600 mt-1">
                  {errors.phone}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="companyName">Company</Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={update("companyName")}
                onInput={handleInput("companyName")}
                onBlur={() => markTouched("companyName")}
                placeholder="Acme Inc."
                aria-invalid={
                  shouldShowError("companyName") && !!errors.companyName
                }
                aria-describedby={
                  shouldShowError("companyName") && errors.companyName
                    ? "companyName-error"
                    : undefined
                }
              />
              {shouldShowError("companyName") && errors.companyName && (
                <p id="companyName-error" className="text-xs text-red-600 mt-1">
                  {errors.companyName}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={update("city")}
                onInput={handleInput("city")}
                onBlur={() => markTouched("city")}
                placeholder="New York"
                aria-invalid={shouldShowError("city") && !!errors.city}
                aria-describedby={
                  shouldShowError("city") && errors.city
                    ? "city-error"
                    : undefined
                }
              />
              {shouldShowError("city") && errors.city && (
                <p id="city-error" className="text-xs text-red-600 mt-1">
                  {errors.city}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={update("state")}
                onInput={handleInput("state")}
                onBlur={() => markTouched("state")}
                placeholder="NY"
                aria-invalid={shouldShowError("state") && !!errors.state}
                aria-describedby={
                  shouldShowError("state") && errors.state
                    ? "state-error"
                    : undefined
                }
              />
              {shouldShowError("state") && errors.state && (
                <p id="state-error" className="text-xs text-red-600 mt-1">
                  {errors.state}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                value={form.pincode}
                onChange={update("pincode")}
                onInput={handleInput("pincode")}
                onBlur={() => markTouched("pincode")}
                placeholder="10001"
                aria-invalid={shouldShowError("pincode") && !!errors.pincode}
                aria-describedby={
                  shouldShowError("pincode") && errors.pincode
                    ? "pincode-error"
                    : undefined
                }
              />
              {shouldShowError("pincode") && errors.pincode && (
                <p id="pincode-error" className="text-xs text-red-600 mt-1">
                  {errors.pincode}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={v =>
                  setForm(prev => ({
                    ...prev,
                    status: v as FormState["status"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="WORKING">Working</SelectItem>
                  <SelectItem value="QUALIFIED">Qualified</SelectItem>
                  <SelectItem value="UNQUALIFIED">Unqualified</SelectItem>
                  <SelectItem value="NURTURING">Nurturing</SelectItem>
                  <SelectItem value="CONVERTED">Converted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={form.source}
                onValueChange={v =>
                  setForm(prev => ({ ...prev, source: v as LeadSource }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="IMPORT">Import</SelectItem>
                  <SelectItem value="LANDING_PAGE">Landing Page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooterAny>
          {submitError && (
            <p className="text-sm text-red-600 mr-auto" role="alert">
              {submitError}
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => resetAndClose()}
            disabled={createLead.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createLead.isPending || hasErrors}
          >
            {createLead.isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                Creating...
              </span>
            ) : (
              "Create Lead"
            )}
          </Button>
        </DialogFooterAny>
      </DialogContentAny>
    </Dialog>
  );
};

export default AddLeadModal;
