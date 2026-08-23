"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
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
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useUpdateLead } from "../hooks/useLeads";
import { toast } from "../lib/toast";
import type { Lead, LeadSource } from "../lib/api/types";
import {
  validateEmail,
  validatePhone,
  validateName,
  validatePincode,
  validateFieldLength,
} from "../lib/validation";
import { useUsers } from "../hooks/useUsers";
import { useUpdateContact } from "../hooks/useContacts";
import { getLeadFullName } from "../lib/name";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onUpdated?: () => void;
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
  ownerId: string; // keep as string for Select; empty string for unassigned
};

export const EditLeadModal: React.FC<Props> = ({
  open,
  onOpenChange,
  lead,
  onUpdated,
}) => {
  const { data: usersResponse } = useUsers();
  const usersData = usersResponse?.data || [];
  const [form, setForm] = useState<FormState>({
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    email: lead.email || "",
    phone: lead.phone || "",
    companyName: lead.companyName || "",
    city: (lead as any).city || "",
    state: (lead as any).state || "",
    pincode: (lead as any).pincode || "",
    status: lead.status as FormState["status"],
    source: lead.source as LeadSource,
    ownerId: (lead as any).ownerId ? String((lead as any).ownerId) : "",
  });

  // Sync when lead changes or modal opens
  React.useEffect(() => {
    setForm({
      firstName: lead.firstName || "",
      lastName: lead.lastName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      companyName: lead.companyName || "",
      city: (lead as any).city || "",
      state: (lead as any).state || "",
      pincode: (lead as any).pincode || "",
      status: lead.status as FormState["status"],
      source: lead.source as LeadSource,
      ownerId: (lead as any).ownerId ? String((lead as any).ownerId) : "",
    });
  }, [lead, open]);

  const updateLead = useUpdateLead();
  const updateContact = useUpdateContact();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};

    const firstNameValidation = validateName(form.firstName);
    if (!firstNameValidation.isValid) e.firstName = firstNameValidation.error;

    if (form.lastName.trim()) {
      const lastNameValidation = validateName(form.lastName);
      if (!lastNameValidation.isValid) e.lastName = lastNameValidation.error;
    }

    const emailValidation = validateEmail(form.email);
    if (!emailValidation.isValid) e.email = emailValidation.error;

    // Validate phone - required field
    // Only validate format if phone has a value to avoid false errors when modal opens
    if (!form.phone || !form.phone.trim()) {
      e.phone = "Phone number is required";
    } else {
      const phoneValidation = validatePhone(form.phone);
      if (!phoneValidation.isValid) e.phone = phoneValidation.error;
    }

    if (form.pincode.trim()) {
      const pincodeValidation = validatePincode(form.pincode);
      if (!pincodeValidation.isValid) e.pincode = pincodeValidation.error;
    }

    if (form.companyName.trim()) {
      const companyValidation = validateFieldLength(form.companyName, 255);
      if (!companyValidation.isValid) e.companyName = companyValidation.error;
    }

    if (form.city.trim()) {
      const cityValidation = validateFieldLength(form.city, 100);
      if (!cityValidation.isValid) e.city = cityValidation.error;
    }

    if (form.state.trim()) {
      const stateValidation = validateFieldLength(form.state, 100);
      if (!stateValidation.isValid) e.state = stateValidation.error;
    }

    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;

  const update =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }));
    };

  const handleSubmit = async () => {
    if (hasErrors) return;
    try {
      setSubmitError(null);
      const trimmedFirstName = form.firstName.trim();
      const trimmedLastName = form.lastName.trim();
      await updateLead.mutateAsync({
        id: lead.id,
        data: {
          firstName: trimmedFirstName,
          lastName: trimmedLastName ? trimmedLastName : null,
          email: form.email.trim(),
          phone: form.phone.trim(),
          companyName: form.companyName.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          pincode: form.pincode.trim() || undefined,
          status: form.status,
          source: form.source,
          ownerId:
            form.ownerId === "" ? ("" as any) : parseInt(form.ownerId, 10),
        },
      });
      // If the lead is converted, also sync basic fields to the linked contact
      const convertedToContactId = (lead as any)?.convertedToContactId as
        | number
        | undefined;
      if (convertedToContactId) {
        try {
          await updateContact.mutateAsync({
            id: convertedToContactId,
            data: {
              name: getLeadFullName(trimmedFirstName, trimmedLastName),
              email: form.email.trim(),
              phone: form.phone.trim(),
            },
          });
        } catch (contactErr) {
          // Warn but don't block lead update completion
          toast.error(contactErr, "Lead saved, but failed to sync contact");
        }
      }
      toast.success("Lead updated successfully");
      onUpdated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err, "Failed to update lead");
      const message = (err as any)?.message || "Failed to update lead";
      setSubmitError(message);
    }
  };

  const DialogContentAny = DialogContent as any;
  const DialogHeaderAny = DialogHeader as any;
  const DialogFooterAny = DialogFooter as any;
  const DialogTitleAny = DialogTitle as any;
  const DialogDescriptionAny = DialogDescription as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentAny className="sm:max-w-[45rem]">
        <DialogHeaderAny className="text-center">
          <DialogTitleAny className="text-center">Edit Lead</DialogTitleAny>
          <DialogDescriptionAny className="text-center">
            Update lead details. Fields marked with{" "}
            <span className="text-destructive">*</span> are required.
          </DialogDescriptionAny>
        </DialogHeaderAny>
        <div className="space-y-4 text-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstName">
                First Name<span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={update("firstName")}
                placeholder="Jane"
                autoFocus
                aria-invalid={!!errors.firstName}
                aria-describedby={
                  errors.firstName ? "firstName-error" : undefined
                }
              />
              {errors.firstName && (
                <p
                  id="firstName-error"
                  className="text-xs text-destructive mt-1"
                >
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
                placeholder="Doe"
                aria-invalid={!!errors.lastName}
                aria-describedby={
                  errors.lastName ? "lastName-error" : undefined
                }
              />
              {errors.lastName && (
                <p
                  id="lastName-error"
                  className="text-xs text-destructive mt-1"
                >
                  {errors.lastName}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">
                Email<span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={update("email")}
                placeholder="jane@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive mt-1">
                  {errors.email}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">
                Phone<span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={update("phone")}
                placeholder="+1 555 0100"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? "phone-error" : undefined}
              />
              {errors.phone && (
                <p id="phone-error" className="text-xs text-destructive mt-1">
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
                placeholder="Acme Inc."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={update("city")}
                placeholder="New York"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={update("state")}
                placeholder="NY"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                value={form.pincode}
                onChange={update("pincode")}
                placeholder="10001"
              />
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
            <div className="flex flex-col gap-2">
              <Label className="text-sm tracking-wide font-bold">
                Assigned To
              </Label>
              <Select
                value={form.ownerId === "" ? "__unassigned__" : form.ownerId}
                onValueChange={v =>
                  setForm(prev => ({
                    ...prev,
                    ownerId: v === "__unassigned__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {(usersData || []).map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooterAny>
          {submitError && (
            <p className="text-sm text-destructive mr-auto" role="alert">
              {submitError}
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateLead.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateLead.isPending || hasErrors}
          >
            {updateLead.isPending ? (
              <span className="inline-flex items-center gap-2">Saving...</span>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooterAny>
      </DialogContentAny>
    </Dialog>
  );
};

export default EditLeadModal;
