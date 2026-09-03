import { isValidEmail, isValidPhone } from "../utils/validators.js";
import { buildFullName } from "../utils/name-helpers.js";

export interface LeadData {
  firstName?: string;
  lastName?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface LeadScoreResult {
  totalScore: number;
  completenessScore: number;
  qualityScore: number;
  missingFields: string[];
  invalidFields: string[];
}

export class LeadScoringService {
  calculateLeadScore(lead: LeadData): LeadScoreResult {
    const derivedName =
      lead.name ?? buildFullName(lead.firstName, lead.lastName);
    const safeLead = {
      name: derivedName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      companyName: lead.companyName || "",
      city: lead.city || "",
      state: lead.state || "",
      pincode: lead.pincode || "",
    };

    const fields = {
      name: safeLead.name,
      email: safeLead.email,
      phone: safeLead.phone,
      companyName: safeLead.companyName,
      city: safeLead.city,
      state: safeLead.state,
      pincode: safeLead.pincode,
    };

    let completenessScore = 0;
    let qualityScore = 0;
    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    Object.entries(fields).forEach(([field, value]) => {
      if (value && value.trim() !== "") {
        completenessScore += 14.3;
      } else {
        missingFields.push(field);
      }
    });

    qualityScore = 100;

    if (fields.email) {
      if (!isValidEmail(fields.email)) {
        qualityScore -= 10;
        invalidFields.push("email");
      }
    }

    if (fields.phone && fields.phone.trim() !== "") {
      if (!isValidPhone(fields.phone)) {
        qualityScore -= 10;
        invalidFields.push("phone");
      }
    }

    qualityScore = Math.max(0, qualityScore);

    const totalScore = Math.round(completenessScore * 0.7 + qualityScore * 0.3);

    return {
      totalScore,
      completenessScore,
      qualityScore,
      missingFields,
      invalidFields,
    };
  }
}
