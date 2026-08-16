import { z } from "zod";

/**
 * Phone number validation schema
 * Exactly 10 digits
 */
export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(/^\d{10}$/, "Phone number must be exactly 10 digits");

/**
 * GST number validation schema
 * Exactly 15 characters (alphanumeric)
 */
export const gstSchema = z
  .string()
  .min(1, "GST number is required")
  .length(15, "GST number must be exactly 15 characters")
  .regex(/^[0-9A-Za-z]{15}$/, "GST number must be alphanumeric");

/**
 * OTP validation schema
 * Exactly 6 digits
 */
export const otpSchema = z
  .string()
  .min(1, "OTP is required")
  .regex(/^\d{6}$/, "OTP must be exactly 6 digits");

/**
 * Email validation schema (optional)
 */
export const emailSchema = z
  .string()
  .email("Invalid email address")
  .optional()
  .or(z.literal(""));

/**
 * Complete subdealer form validation schema
 */
export const subdealerFormSchema = z.object({
  phone: phoneSchema,
  gstNumber: gstSchema,
  otp: otpSchema,
  gstDetails: z.object({
    gstNumber: gstSchema,
    legalName: z.string().min(1, "Legal name is required"),
    tradeName: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    panNumber: z.string().optional(),
    registrationDate: z.string().optional(),
    businessType: z.string().optional(),
    status: z.string().optional(),
    jurisdiction: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
  }),
});

export type SubdealerFormData = z.infer<typeof subdealerFormSchema>;
