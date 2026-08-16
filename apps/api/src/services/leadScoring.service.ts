import { isValidEmail, isValidPhone } from "../utils/validators.js";
import { buildFullName } from "../utils/nameHelpers.js";

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
    console.log("=== CALCULATING LEAD SCORE ===");
    console.log("Lead data:", JSON.stringify(lead, null, 2));
    console.log("Starting score calculation...");

    // Ensure all fields are properly handled
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

    console.log("Safe lead data:", JSON.stringify(safeLead, null, 2));

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

    // Completeness scoring (approx 14.3 points per field = ~100 max for 7 fields)
    Object.entries(fields).forEach(([field, value]) => {
      if (value && value.trim() !== "") {
        completenessScore += 14.3;
        console.log(`✓ Field "${field}" present (+14.3 points)`);
      } else {
        missingFields.push(field);
        console.log(`✗ Field "${field}" missing (0 points)`);
      }
    });

    console.log(`Completeness Score: ${completenessScore}/100`);
    console.log(`Missing Fields: [${missingFields.join(", ")}]`);

    // Quality scoring (start at 100, deduct for invalid data)
    qualityScore = 100;

    if (fields.email) {
      if (!isValidEmail(fields.email)) {
        qualityScore -= 10;
        invalidFields.push("email");
        console.log(`✗ Invalid email format (-10 points)`);
      } else {
        console.log(`✓ Valid email format`);
      }
    }

    if (fields.phone && fields.phone.trim() !== "") {
      if (!isValidPhone(fields.phone)) {
        qualityScore -= 10;
        invalidFields.push("phone");
        console.log(`✗ Invalid phone format (-10 points)`);
      } else {
        console.log(`✓ Valid phone format`);
      }
    }

    qualityScore = Math.max(0, qualityScore);
    console.log(`Quality Score: ${qualityScore}/100`);
    console.log(`Invalid Fields: [${invalidFields.join(", ")}]`);

    // Final score: 70% completeness + 30% quality
    const totalScore = Math.round(completenessScore * 0.7 + qualityScore * 0.3);

    console.log(`\n=== FINAL SCORE BREAKDOWN ===`);
    console.log(
      `Completeness: ${completenessScore} (70% weight = ${Math.round(completenessScore * 0.7)})`
    );
    console.log(
      `Quality: ${qualityScore} (30% weight = ${Math.round(qualityScore * 0.3)})`
    );
    console.log(`TOTAL SCORE: ${totalScore}/100`);
    console.log("================================\n");

    return {
      totalScore,
      completenessScore,
      qualityScore,
      missingFields,
      invalidFields,
    };
  }
}
