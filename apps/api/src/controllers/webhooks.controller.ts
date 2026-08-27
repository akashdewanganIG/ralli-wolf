import { Request, Response } from "express";
import crypto from "crypto";
import { handleError } from "../utils/errorHandler.js";
import { prisma, LeadStatus, LeadSource } from "@repo/db";
import {
  isValidEmail,
  isValidPhone,
  isValidName,
  isValidPincode,
  normalizeEmail,
  validateFieldLength,
} from "../utils/validators.js";

// Extend Express Request to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

/**
 * Helper: mask email for logs
 */
function maskEmail(email?: string | null) {
  if (!email) return null;
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const name = parts[0];
  const domain = parts[1];
  if (!name || !domain) return "***";
  const visible = name.length <= 2 ? name[0] : name.slice(0, 2);
  return `${visible}***@${domain}`;
}

/**
 * Helper: mask phone for logs
 */
function maskPhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "***";
  return `***${digits.slice(-4)}`;
}

/**
 * Normalize phone number to 10-digit local format (no country code).
 * Returns null if normalization fails.
 */
function normalizePhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== "string") return null;
  let digits = phone.replace(/\D/g, "");
  // If starts with '91' and length 12 -> strip leading 91
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  // If starts with a leading 0 (011...), trim to last 10 digits if sensible
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  if (digits.length === 10) return digits;
  return null;
}

/**
 * Truncate object to avoid storing huge payloads. Keeps top-level keys but truncates long strings.
 */
function sanitizeForStorage(obj: any, maxLen = 4000) {
  try {
    const clone: any = {};
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (v == null) {
        clone[k] = v;
      } else if (typeof v === "string") {
        clone[k] =
          v.length > maxLen ? `${v.slice(0, maxLen)}... [truncated]` : v;
      } else if (typeof v === "object") {
        // shallow stringify, truncated
        const str = JSON.stringify(v);
        clone[k] =
          str.length > maxLen
            ? `${str.slice(0, maxLen)}... [truncated]`
            : JSON.parse(str);
      } else {
        clone[k] = v;
      }
    }
    return clone;
  } catch (_e) {
    return { _error: "sanitization_failed" };
  }
}

export class WebhookController {
  async handleLandingiWebhook(req: Request, res: Response) {
    try {
      // Basic request logging without exposing full PII
      console.log("🎯 Landingi Webhook Received");
      console.log("📅 Timestamp:", new Date().toISOString());
      console.log("📋 Headers:", Object.keys(req.headers));
      console.log("🔗 IP Address:", req.ip || req.connection.remoteAddress);
      console.log("📝 User Agent:", req.get("User-Agent") || "Not provided");

      // Optional: verify signature if configured
      const secret = process.env.LANDINGI_WEBHOOK_SECRET;
      if (secret) {
        const signatureHeader =
          req.get("x-landingi-signature") ||
          req.get("x-hub-signature-256") ||
          req.get("x-signature");
        if (!signatureHeader) {
          console.warn(
            "⚠️ Webhook signature header missing but secret is configured"
          );
          return res
            .status(401)
            .json({ success: false, message: "Missing webhook signature" });
        }
        const payload = req.rawBody ?? JSON.stringify(req.body); // ensure rawBody available from middleware if possible
        const computed = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
        if (
          !crypto.timingSafeEqual(
            Buffer.from(computed),
            Buffer.from(signatureHeader)
          )
        ) {
          console.warn("⚠️ Invalid webhook signature");
          return res
            .status(401)
            .json({ success: false, message: "Invalid webhook signature" });
        }
        console.log("🔐 Webhook signature verified");
      } else {
        console.log(
          "ℹ️ No webhook secret configured; skipping signature verification"
        );
      }

      // Parse webhook body
      const webhookData = req.body ?? {};
      const safeSummary = {
        keys: Object.keys(webhookData || {}),
        sample: {
          email: maskEmail(
            (webhookData.form_submission?.email as string) ||
              webhookData.email ||
              webhookData.custom_fields?.email
          ),
          phone: maskPhone(
            (webhookData.form_submission?.phone as string) ||
              webhookData.phone ||
              webhookData.custom_fields?.phone
          ),
        },
      };
      console.log("📦 Webhook summary:", safeSummary);

      let createdLead = null;
      let createdFormSubmission = null;

      // Extract lead and attempt to persist lead + enquiry
      try {
        const leadData = this.extractLeadDataFromWebhook(webhookData);
        if (leadData) {
          console.log("💾 Attempting to store lead (masked):", {
            name: leadData.name ? `${leadData.name.split(" ")[0]} ***` : null,
            email: maskEmail(leadData.email),
            phone: maskPhone(leadData.phone),
          });

          const campaignUniqueId =
            this.extractLandingPageCampaignId(webhookData);
          const customFields = this.extractCustomFields(webhookData);

          createdLead = await this.storeLeadWithEnquiry(
            leadData,
            campaignUniqueId,
            customFields
          );
          console.log("✅ Lead stored (id):", createdLead?.id);
        } else {
          console.log("⚠️ No valid lead data found in webhook");
        }
      } catch (leadError) {
        console.error("❌ Error storing lead and enquiry (masked):", {
          message:
            leadError instanceof Error ? leadError.message : String(leadError),
        });
        // proceed without throwing to keep webhook acceptance resilient
      }

      // Store form submission (sanitized)
      try {
        const formSubmissionData = this.extractFormSubmissionData(
          webhookData,
          createdLead
        );
        if (formSubmissionData) {
          createdFormSubmission =
            await this.storeFormSubmission(formSubmissionData);
          console.log(
            "✅ Form submission stored (id):",
            createdFormSubmission?.id
          );
        } else {
          console.log("⚠️ No valid form submission data found in webhook");
        }
      } catch (formSubmissionError) {
        console.error("❌ Error storing form submission:", {
          message:
            formSubmissionError instanceof Error
              ? formSubmissionError.message
              : String(formSubmissionError),
        });
      }

      return res.status(200).json({
        success: true,
        message: "Webhook received and processed",
        timestamp: new Date().toISOString(),
        receivedKeys: Object.keys(webhookData || {}),
        leadCreated: !!createdLead,
        leadId: createdLead?.id ?? null,
        formSubmissionCreated: !!createdFormSubmission,
        formSubmissionId: createdFormSubmission?.id ?? null,
      });
    } catch (error) {
      console.error(
        "❌ Unhandled error processing Landingi webhook:",
        error instanceof Error ? error.message : String(error)
      );
      handleError(error, res, "Process Landingi webhook");
    }
  }

  async testLandingiWebhook(req: Request, res: Response) {
    console.log(
      "🧪 Landingi Webhook Test Endpoint Accessed",
      new Date().toISOString()
    );
    return res.json({
      success: true,
      message: "Landingi webhook test endpoint is working",
      timestamp: new Date().toISOString(),
      webhookUrl: `${req.protocol}://${req.get("host")}/api/webhook/landingi`,
      instructions:
        "Send POST requests to the webhook URL to test the webhook receiver",
    });
  }

  private extractLandingPageCampaignId(webhookData: any): string | null {
    try {
      return (
        webhookData.landing_page_campaign_id ??
        webhookData.campaign_id ??
        webhookData.campaignId ??
        webhookData.landingPageCampaignId ??
        webhookData.lpCampaignId ??
        webhookData.form_submission?.campaign_id ??
        webhookData.form_submission?.landing_page_campaign_id ??
        webhookData.custom_fields?.landing_page_campaign_id ??
        webhookData.custom_fields?.campaign_id ??
        null
      );
    } catch (error) {
      console.error("Error extracting landing page campaign ID:", error);
      return null;
    }
  }

  private extractCustomFields(webhookData: any): any | null {
    try {
      const contactFields = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "phone_number",
        "telephone",
        "company",
        "company_name",
        "organization",
        "business_name",
        "city",
        "state",
        "pincode",
        "pin_code",
        "zipcode",
        "zip_code",
        "campaign_id",
        "campaignId",
        "landingPageCampaignId",
        "lpCampaignId",
      ].map(f => f.toLowerCase());

      const customFields: any = {};

      const extractFrom = (source: any) => {
        if (!source || typeof source !== "object") return;
        for (const key of Object.keys(source)) {
          const kl = key.toLowerCase();
          if (!contactFields.includes(kl) && source[key] != null) {
            customFields[key] = source[key];
          }
        }
      };

      extractFrom(webhookData.form_submission);
      extractFrom(webhookData.custom_fields);
      // direct fields
      for (const key of Object.keys(webhookData || {})) {
        if (
          ![
            "form_submission",
            "custom_fields",
            "lead",
            "campaign",
            "landing_page",
          ].includes(key) &&
          !contactFields.includes(key.toLowerCase())
        ) {
          customFields[key] = webhookData[key];
        }
      }

      return Object.keys(customFields).length > 0 ? customFields : null;
    } catch (error) {
      console.error("Error extracting custom fields:", error);
      return null;
    }
  }

  private extractLeadDataFromWebhook(webhookData: any): any | null {
    try {
      // prefer form_submission
      if (webhookData.form_submission) {
        const formData = webhookData.form_submission;
        return this.extractLeadFromFormSubmission(formData);
      }

      if (webhookData.lead) {
        return this.extractLeadFromLeadObject(webhookData.lead);
      }

      if (webhookData.email || webhookData.name) {
        return this.extractLeadFromDirectFields(webhookData);
      }

      if (webhookData.custom_fields) {
        return this.extractLeadFromCustomFields(webhookData.custom_fields);
      }

      return null;
    } catch (error) {
      console.error("Error extracting lead data:", error);
      return null;
    }
  }

  private extractLeadFromFormSubmission(formData: any): any | null {
    const leadData: any = {};

    // First & last name (required)
    leadData.firstName = formData.firstName?.trim() || null;
    leadData.lastName = formData.lastName?.trim() || null;

    // Email (required). Normalised on the way in so the dedup lookup below
    // matches regardless of how the form filled it in.
    leadData.email = normalizeEmail(formData.email);

    // Phone (optional but normalized)
    if (formData.phone || formData.phone_number || formData.telephone) {
      leadData.phone = normalizePhone(
        formData.phone || formData.phone_number || formData.telephone
      );
    }

    // Company (optional)
    leadData.companyName =
      formData.company ||
      formData.company_name ||
      formData.organization ||
      formData.business_name ||
      null;

    leadData.city = formData.city || null;
    leadData.state = formData.state || null;
    leadData.pincode =
      formData.pincode ||
      formData.pin_code ||
      formData.zipcode ||
      formData.zip_code ||
      null;

    // Required check
    if (!leadData.firstName || !leadData.email) {
      console.log("❌ Missing firstName or email");
      return null;
    }

    return leadData;
  }

  private extractLeadFromLeadObject(leadData: any): any | null {
    const extracted: any = {
      firstName: leadData.firstName?.trim() || null,
      lastName: leadData.lastName?.trim() || null,
      email: normalizeEmail(leadData.email),
      phone: leadData.phone ? normalizePhone(leadData.phone) : null,
    };

    if (!extracted.firstName || !extracted.email) {
      console.log("❌ Missing required firstName or email in lead object");
      return null;
    }

    return extracted;
  }

  private extractLeadFromDirectFields(webhookData: any): any | null {
    const leadData: any = {};

    leadData.firstName = webhookData.firstName?.trim() || null;
    leadData.lastName = webhookData.lastName?.trim() || null;
    leadData.email = normalizeEmail(webhookData.email);

    if (
      webhookData.phone ||
      webhookData.phone_number ||
      webhookData.telephone
    ) {
      leadData.phone = normalizePhone(
        webhookData.phone || webhookData.phone_number || webhookData.telephone
      );
    }

    if (!leadData.firstName || !leadData.email) {
      console.log("❌ Missing required firstName or email");
      return null;
    }

    return leadData;
  }

  private extractLeadFromCustomFields(customFields: any): any | null {
    const leadData: any = {
      firstName: customFields.firstName?.trim() || null,
      lastName: customFields.lastName?.trim() || null,
      email: normalizeEmail(customFields.email),
    };

    if (customFields.phone) {
      leadData.phone = normalizePhone(customFields.phone);
    }

    if (!leadData.firstName || !leadData.email) {
      console.log("❌ Missing required firstName or email in custom fields");
      return null;
    }

    return leadData;
  }

  private async storeLeadWithEnquiry(
    leadData: any,
    campaignUniqueId: string | null,
    customFields: any
  ): Promise<any> {
    try {
      // Basic validations
      if (!leadData.firstName || !isValidName(leadData.firstName)) {
        throw new Error(
          "Invalid or missing name. Name must be non-empty (max 255 characters)"
        );
      }

      if (!leadData.email || !isValidEmail(leadData.email)) {
        throw new Error("Invalid or missing email.");
      }

      if (leadData.phone && !isValidPhone(leadData.phone)) {
        throw new Error("Invalid phone number. Phone must be 10 digits");
      }

      if (leadData.pincode && !isValidPincode(leadData.pincode)) {
        throw new Error("Invalid pincode. Pincode must be exactly 6 digits");
      }

      if (
        leadData.companyName &&
        !validateFieldLength(leadData.companyName, 255)
      ) {
        throw new Error("Company name must be 255 characters or less");
      }

      if (leadData.city && !validateFieldLength(leadData.city, 100)) {
        throw new Error("City must be 100 characters or less");
      }

      if (leadData.state && !validateFieldLength(leadData.state, 100)) {
        throw new Error("State must be 100 characters or less");
      }

      const enumSource: LeadSource = LeadSource.LANDING_PAGE;
      const enumStatus: LeadStatus = LeadStatus.OPEN;

      // Deduplication logic: prefer email -> phone
      let existingLead = null;
      if (leadData.email) {
        existingLead = await prisma.lead.findFirst({
          where: { email: leadData.email, deletedAt: null },
          include: { owner: true },
        });
      }

      if (!existingLead && leadData.phone) {
        existingLead = await prisma.lead.findFirst({
          where: { phone: leadData.phone, deletedAt: null },
          include: { owner: true },
        });
      }

      let lead;
      let landingPageCampaign = null;

      if (campaignUniqueId) {
        landingPageCampaign = await prisma.landingPageCampaign.findUnique({
          where: { uniqueId: campaignUniqueId },
        });
        if (!landingPageCampaign) {
          console.warn(
            `⚠️ Landing page campaign not found with uniqueId: ${campaignUniqueId}`
          );
        }
      }

      if (existingLead) {
        console.log(
          "📧 Existing lead found, creating enquiry for lead id:",
          existingLead.id
        );
        lead = existingLead;

        await prisma.enquiry.create({
          data: {
            leadId: existingLead.id,
            landingPageCampaignId: landingPageCampaign?.id ?? null,
            customFields: customFields,
            status: "UNRESOLVED",
          },
        });

        return lead;
      } else {
        console.log("🆕 Creating new lead and enquiry");
        const result = await prisma.$transaction(async tx => {
          const newLead = await tx.lead.create({
            data: {
              firstName: leadData.firstName,
              lastName: leadData.lastName,
              email: leadData.email,
              phone: leadData.phone ?? null,
              companyName: leadData.companyName ?? null,
              city: leadData.city ?? null,
              state: leadData.state ?? null,
              pincode: leadData.pincode ?? null,
              source: enumSource,
              status: enumStatus,
              score: 0,
            },
          });

          await tx.enquiry.create({
            data: {
              leadId: newLead.id,
              landingPageCampaignId: landingPageCampaign?.id ?? null,
              customFields: customFields,
              status: "UNRESOLVED",
            },
          });

          return newLead;
        });

        return result;
      }
    } catch (error) {
      console.error(
        "Database error storing lead and enquiry:",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private extractFormSubmissionData(
    webhookData: any,
    createdLead: any
  ): any | null {
    try {
      const sanitized = sanitizeForStorage(webhookData, 2000);

      const formSubmissionData = {
        leadId: createdLead?.id ?? null,
        contactId: null,
        formData: {
          webhookSummary: {
            keys: Object.keys(webhookData || {}),
            sample: {
              email: maskEmail(
                webhookData.form_submission?.email ||
                  webhookData.email ||
                  webhookData.custom_fields?.email
              ),
              phone: maskPhone(
                webhookData.form_submission?.phone ||
                  webhookData.phone ||
                  webhookData.custom_fields?.phone
              ),
            },
          },
          webhookData: sanitized,
          extractedAt: new Date().toISOString(),
          source: "Landingi Webhook",
        },
      };

      return formSubmissionData;
    } catch (error) {
      console.error("Error extracting form submission data:", error);
      return null;
    }
  }

  private async storeFormSubmission(formSubmissionData: any): Promise<any> {
    try {
      const newFormSubmission = await prisma.formSubmission.create({
        data: {
          leadId: formSubmissionData.leadId,
          contactId: formSubmissionData.contactId,
          formData: formSubmissionData.formData,
        },
        include: {
          lead: true,
          contact: true,
        },
      });

      return newFormSubmission;
    } catch (error) {
      console.error("Database error storing form submission:", error);
      throw error;
    }
  }
}
