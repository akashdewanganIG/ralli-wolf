import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { gstService, GstDetails } from "../services/gst.service.js";
import { msg91Service } from "../services/msg91.service.js";
import { isValidPhone, isValidGstNumber } from "../utils/validators.js";
import {
  handleError,
  handleValidationError,
  handleUnauthorizedError,
} from "../utils/errorHandler.js";

export class SubdealerController {
  /**
   * Fetch GST details by GST number
   * POST /api/subdealer/fetch-gst { gstNumber }
   */
  async fetchGstDetails(req: Request, res: Response) {
    try {
      const { gstNumber } = req.body as { gstNumber?: string };

      if (!gstNumber) {
        return handleValidationError(
          res,
          "GST number is required",
          "gstNumber",
          "Fetch GST details"
        );
      }

      // Validate GST number format
      if (!isValidGstNumber(gstNumber)) {
        return handleValidationError(
          res,
          "Invalid GST number. GST number must be exactly 15 characters (alphanumeric)",
          "gstNumber",
          "Fetch GST details"
        );
      }

      // Check if GST number already exists
      const existingSubdealer = await prisma.subdealer.findUnique({
        where: { gstNumber: gstNumber.trim().toUpperCase() },
      });

      if (existingSubdealer) {
        return handleValidationError(
          res,
          "GST number already registered",
          "gstNumber",
          "Fetch GST details"
        );
      }

      // Fetch GST details from service
      const gstDetails = await gstService.fetchGstDetails(gstNumber);

      return res.json({
        success: true,
        data: gstDetails,
      });
    } catch (error) {
      handleError(error, res, "Fetch GST details");
    }
  }

  /**
   * Generate and send OTP to phone number
   * POST /api/subdealer/generate-otp { phone }
   */
  async generateOtp(req: Request, res: Response) {
    try {
      const { phone } = req.body as { phone?: string };

      if (!phone) {
        return handleValidationError(
          res,
          "Phone number is required",
          "phone",
          "Generate OTP"
        );
      }

      // Normalize phone number (remove +91, 91 prefix, spaces)
      const normalizedPhone = phone.replace(/[-\s+()]/g, "").replace(/^91/, "");

      // Validate phone number (10 digits, starting with 6-9)
      if (!isValidPhone(normalizedPhone)) {
        return handleValidationError(
          res,
          "Invalid phone number. Phone must be 10 digits",
          "phone",
          "Generate OTP"
        );
      }

      // Generate OTP (MSG91 will generate it, but we need to pass a placeholder)
      // MSG91 generates the OTP automatically, so we pass an empty string
      const otpSent = await msg91Service.sendOtp(normalizedPhone, "");

      if (!otpSent) {
        return handleError(
          new Error("Failed to send OTP via MSG91"),
          res,
          "Generate OTP"
        );
      }

      return res.json({
        success: true,
        message: "OTP sent successfully",
      });
    } catch (error) {
      handleError(error, res, "Generate OTP");
    }
  }

  /**
   * Verify OTP and create subdealer
   * POST /api/subdealer/verify-otp { phone, otp, gstDetails }
   */
  async verifyOtpAndRegister(req: Request, res: Response) {
    try {
      const { phone, otp, gstDetails } = req.body as {
        phone?: string;
        otp?: string;
        gstDetails?: GstDetails & { gstNumber: string; email?: string };
      };

      if (!phone || !otp || !gstDetails) {
        return handleValidationError(
          res,
          "Phone, OTP, and GST details are required",
          undefined,
          "Verify OTP"
        );
      }

      // Normalize phone number
      const normalizedPhone = phone.replace(/[-\s+()]/g, "").replace(/^91/, "");

      // Validate phone number
      if (!isValidPhone(normalizedPhone)) {
        return handleValidationError(
          res,
          "Invalid phone number",
          "phone",
          "Verify OTP"
        );
      }

      // Validate GST number
      if (!gstDetails.gstNumber || !isValidGstNumber(gstDetails.gstNumber)) {
        return handleValidationError(
          res,
          "Invalid GST number",
          "gstNumber",
          "Verify OTP"
        );
      }

      // Validate required GST fields
      if (!gstDetails.legalName) {
        return handleValidationError(
          res,
          "Legal name is required",
          "legalName",
          "Verify OTP"
        );
      }

      const normalizedGst = gstDetails.gstNumber.trim().toUpperCase();

      // Early duplicate check
      const earlyDuplicateCheck = await Promise.all([
        prisma.subdealer.findUnique({
          where: { phone: normalizedPhone },
        }),
        prisma.subdealer.findUnique({
          where: { gstNumber: normalizedGst },
        }),
      ]);

      if (earlyDuplicateCheck[0]) {
        return handleValidationError(
          res,
          "Phone number already registered",
          "phone",
          "Verify OTP"
        );
      }

      if (earlyDuplicateCheck[1]) {
        return handleValidationError(
          res,
          "GST number already registered",
          "gstNumber",
          "Verify OTP"
        );
      }

      // Verify OTP via MSG91
      const isOtpValid = await msg91Service.verifyOtp(normalizedPhone, otp);

      if (!isOtpValid) {
        return handleUnauthorizedError(
          res,
          "Invalid or expired OTP",
          "Verify OTP"
        );
      }

      // Create subdealer record
      // Use transaction to ensure atomicity of registration
      const subdealer = await prisma.$transaction(async tx => {
        // Check for duplicate phone or GST again within transaction (prevents race conditions)
        const duplicateCheck = await Promise.all([
          tx.subdealer.findUnique({
            where: { phone: normalizedPhone },
          }),
          tx.subdealer.findUnique({
            where: { gstNumber: normalizedGst },
          }),
        ]);

        if (duplicateCheck[0]) {
          throw new Error("Phone number already registered");
        }

        if (duplicateCheck[1]) {
          throw new Error("GST number already registered");
        }

        // Create subdealer record
        return tx.subdealer.create({
          data: {
            phone: normalizedPhone,
            gstNumber: normalizedGst,
            email: gstDetails.email || null,
            legalName: gstDetails.legalName,
            tradeName: gstDetails.tradeName || null,
            address: gstDetails.address || null,
            city: gstDetails.city || null,
            state: gstDetails.state || null,
            pincode: gstDetails.pincode || null,
            panNumber: gstDetails.panNumber || null,
            registrationDate: gstDetails.registrationDate
              ? new Date(gstDetails.registrationDate)
              : null,
            businessType: gstDetails.businessType || null,
            status: gstDetails.status || null,
            jurisdiction: gstDetails.jurisdiction || null,
            phoneVerified: true,
            verifiedAt: new Date(),
          },
        });
      });

      // Generate JWT token for subdealer
      const { generateSubdealerToken } = await import("../utils/jwt.utils.js");
      const token = generateSubdealerToken(
        subdealer.id,
        subdealer.phone,
        subdealer.gstNumber
      );

      // Store token in database
      await prisma.subdealer.update({
        where: { id: subdealer.id },
        data: {
          jwtToken: token,
          tokenIssuedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        message: "Subdealer registered successfully",
        data: {
          id: subdealer.id,
          phone: subdealer.phone,
          gstNumber: subdealer.gstNumber,
          legalName: subdealer.legalName,
        },
        token, // Return token to client
      });
    } catch (error: any) {
      // Handle transaction errors with specific messages
      if (error?.message) {
        if (error.message === "Phone number already registered") {
          return handleValidationError(
            res,
            "Phone number already registered",
            "phone",
            "Verify OTP"
          );
        }
        if (error.message === "GST number already registered") {
          return handleValidationError(
            res,
            "GST number already registered",
            "gstNumber",
            "Verify OTP"
          );
        }
      }
      handleError(error, res, "Verify OTP and Register");
    }
  }

  /**
   * Check if phone number exists
   * POST /api/subdealer/check-phone { phone }
   */
  async checkPhone(req: Request, res: Response) {
    try {
      const { phone } = req.body as { phone?: string };

      if (!phone) {
        return handleValidationError(
          res,
          "Phone number is required",
          "phone",
          "Check Phone"
        );
      }

      // Normalize phone number
      const normalizedPhone = phone.replace(/[-\s+()]/g, "").replace(/^91/, "");

      // Validate phone number
      if (!isValidPhone(normalizedPhone)) {
        return handleValidationError(
          res,
          "Invalid phone number",
          "phone",
          "Check Phone"
        );
      }

      // Check if phone exists
      const subdealer = await prisma.subdealer.findUnique({
        where: { phone: normalizedPhone },
        select: {
          id: true,
          phone: true,
          gstNumber: true,
          legalName: true,
          tradeName: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          panNumber: true,
          businessType: true,
          status: true,
        },
      });

      return res.json({
        success: true,
        exists: !!subdealer,
        data: subdealer || null,
      });
    } catch (error) {
      handleError(error, res, "Check Phone");
    }
  }

  /**
   * Login existing subdealer
   * POST /api/subdealer/login { phone, otp }
   */
  async login(req: Request, res: Response) {
    try {
      const { phone, otp } = req.body as { phone?: string; otp?: string };

      if (!phone || !otp) {
        return handleValidationError(
          res,
          "Phone and OTP are required",
          undefined,
          "Login"
        );
      }

      // Normalize phone number
      const normalizedPhone = phone.replace(/[-\s+()]/g, "").replace(/^91/, "");

      // Validate phone number
      if (!isValidPhone(normalizedPhone)) {
        return handleValidationError(
          res,
          "Invalid phone number",
          "phone",
          "Login"
        );
      }

      // Check if subdealer exists
      const subdealer = await prisma.subdealer.findUnique({
        where: { phone: normalizedPhone },
      });

      if (!subdealer) {
        return handleValidationError(
          res,
          "Phone number not registered",
          "phone",
          "Login"
        );
      }

      // Verify OTP via MSG91
      const isOtpValid = await msg91Service.verifyOtp(normalizedPhone, otp);

      if (!isOtpValid) {
        return handleUnauthorizedError(res, "Invalid or expired OTP", "Login");
      }

      // Generate new JWT token
      const { generateSubdealerToken } = await import("../utils/jwt.utils.js");
      const token = generateSubdealerToken(
        subdealer.id,
        subdealer.phone,
        subdealer.gstNumber
      );

      // Update token in database
      await prisma.subdealer.update({
        where: { id: subdealer.id },
        data: {
          jwtToken: token,
          tokenIssuedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        message: "Login successful",
        data: {
          id: subdealer.id,
          phone: subdealer.phone,
          gstNumber: subdealer.gstNumber,
          legalName: subdealer.legalName,
        },
        token,
      });
    } catch (error) {
      handleError(error, res, "Login");
    }
  }
}
