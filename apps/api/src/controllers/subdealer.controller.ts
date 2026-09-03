import { Request, Response } from "express";
import { prisma } from "@repo/db";
import type { Subdealer } from "@prisma/client";
import {
  gstService,
  GstRecordNotFoundError,
  GstServiceUnavailableError,
} from "../services/gst.service.js";
import { msg91Service } from "../services/msg91.service.js";
import {
  isValidEmail,
  isValidPhone,
  isValidGstNumber,
  normalizeEmail,
} from "../utils/validators.js";
import {
  handleError,
  handleValidationError,
  handleUnauthorizedError,
} from "../utils/error-handler.js";
import { generateSubdealerToken, hashBearerToken } from "../utils/jwt.utils.js";

function publicSubdealer(subdealer: Subdealer) {
  return {
    id: subdealer.id,
    phone: subdealer.phone,
    gstNumber: subdealer.gstNumber,
    legalName: subdealer.legalName,
    tradeName: subdealer.tradeName,
    address: subdealer.address,
    city: subdealer.city,
    state: subdealer.state,
    pincode: subdealer.pincode,
    panNumber: subdealer.panNumber,
    registrationDate: subdealer.registrationDate,
    businessType: subdealer.businessType,
    status: subdealer.status,
    jurisdiction: subdealer.jurisdiction,
    email: subdealer.email,
  };
}

export class SubdealerController {
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

      if (!isValidGstNumber(gstNumber)) {
        return handleValidationError(
          res,
          "Invalid GST number. GST number must be exactly 15 characters (alphanumeric)",
          "gstNumber",
          "Fetch GST details"
        );
      }

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

      const gstDetails = await gstService.fetchGstDetails(gstNumber);

      return res.json({
        success: true,
        data: gstDetails,
      });
    } catch (error) {
      if (error instanceof GstRecordNotFoundError) {
        return res.status(422).json({
          error: "GST registration could not be verified",
        });
      }
      if (error instanceof GstServiceUnavailableError) {
        return res.status(503).json({
          error: "GST verification is temporarily unavailable",
        });
      }
      handleError(error, res, "Fetch GST details");
    }
  }

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

      const normalizedPhone = phone.replace(/[-\s+()]/g, "").replace(/^91/, "");

      if (!isValidPhone(normalizedPhone)) {
        return handleValidationError(
          res,
          "Invalid phone number. Phone must be 10 digits",
          "phone",
          "Generate OTP"
        );
      }

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

  async verifyOtpAndRegister(req: Request, res: Response) {
    try {
      const { phone, otp, gstNumber, email } = req.body as {
        phone?: string;
        otp?: string;
        gstNumber?: string;
        email?: string;
      };

      if (!phone || !otp || !gstNumber) {
        return handleValidationError(
          res,
          "Phone, OTP, and GST number are required",
          undefined,
          "Verify OTP"
        );
      }

      const normalizedPhone = phone.replace(/[-\s+()]/g, "").replace(/^91/, "");

      if (!isValidPhone(normalizedPhone)) {
        return handleValidationError(
          res,
          "Invalid phone number",
          "phone",
          "Verify OTP"
        );
      }

      if (!isValidGstNumber(gstNumber)) {
        return handleValidationError(
          res,
          "Invalid GST number",
          "gstNumber",
          "Verify OTP"
        );
      }

      const normalizedGst = gstNumber.trim().toUpperCase();
      const normalizedEmail = normalizeEmail(email);
      if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return handleValidationError(
          res,
          "Invalid email address",
          "email",
          "Verify OTP"
        );
      }

      const isOtpValid = await msg91Service.verifyOtp(normalizedPhone, otp);

      if (!isOtpValid) {
        return handleUnauthorizedError(
          res,
          "Invalid or expired OTP",
          "Verify OTP"
        );
      }

      const verifiedGst = await gstService.fetchGstDetails(normalizedGst);

      const registration = await prisma.$transaction(async tx => {
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

        const subdealer = await tx.subdealer.create({
          data: {
            phone: normalizedPhone,
            gstNumber: normalizedGst,
            email: normalizedEmail,
            legalName: verifiedGst.legalName,
            tradeName: verifiedGst.tradeName || null,
            address: verifiedGst.address || null,
            city: verifiedGst.city || null,
            state: verifiedGst.state || null,
            pincode: verifiedGst.pincode || null,
            panNumber: verifiedGst.panNumber || null,
            registrationDate: verifiedGst.registrationDate
              ? new Date(verifiedGst.registrationDate)
              : null,
            businessType: verifiedGst.businessType || null,
            status: verifiedGst.status || null,
            jurisdiction: verifiedGst.jurisdiction || null,
            phoneVerified: true,
            verifiedAt: new Date(),
          },
        });
        const token = generateSubdealerToken(
          subdealer.id,
          subdealer.phone,
          subdealer.gstNumber
        );
        await tx.subdealer.update({
          where: { id: subdealer.id },
          data: {
            jwtTokenHash: hashBearerToken(token),
            tokenIssuedAt: new Date(),
          },
        });
        return { subdealer, token };
      });
      const { subdealer, token } = registration;

      return res.json({
        success: true,
        message: "Subdealer registered successfully",
        data: publicSubdealer(subdealer),
        token,
      });
    } catch (error: unknown) {
      if (error instanceof GstRecordNotFoundError) {
        return res.status(422).json({
          error: "GST registration could not be verified",
        });
      }
      if (error instanceof GstServiceUnavailableError) {
        return res.status(503).json({
          error: "GST verification is temporarily unavailable",
        });
      }

      if (error instanceof Error) {
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

      const normalizedPhone = phone.replace(/[-\s+()]/g, "").replace(/^91/, "");

      if (!isValidPhone(normalizedPhone)) {
        return handleValidationError(
          res,
          "Invalid phone number",
          "phone",
          "Login"
        );
      }

      const isOtpValid = await msg91Service.verifyOtp(normalizedPhone, otp);

      const subdealer = isOtpValid
        ? await prisma.subdealer.findUnique({
            where: { phone: normalizedPhone },
          })
        : null;
      if (!isOtpValid || !subdealer) {
        return handleUnauthorizedError(res, "Invalid or expired OTP", "Login");
      }

      const token = generateSubdealerToken(
        subdealer.id,
        subdealer.phone,
        subdealer.gstNumber
      );

      await prisma.subdealer.update({
        where: { id: subdealer.id },
        data: {
          jwtTokenHash: hashBearerToken(token),
          tokenIssuedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        message: "Login successful",
        data: publicSubdealer(subdealer),
        token,
      });
    } catch (error) {
      handleError(error, res, "Login");
    }
  }

  async logout(req: Request, res: Response) {
    try {
      if (!req.subdealer) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Logout"
        );
      }
      await prisma.subdealer.updateMany({
        where: { id: req.subdealer.id },
        data: { jwtTokenHash: null, tokenIssuedAt: null },
      });
      return res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      handleError(error, res, "Logout");
    }
  }
}
