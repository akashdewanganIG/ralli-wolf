import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/errorHandler.js";
import { uploadToS3, deleteFromS3ByUrl } from "../services/s3.service.js";
import { isValidPhone } from "../utils/validators.js";

export class InvoiceController {
  /**
   * Helper: Parse and validate invoice ID from request params
   * Returns null if invalid (caller should handle response)
   */
  private parseInvoiceId(
    id: string | undefined,
    res: Response,
    operation: string
  ): number | null {
    if (!id) {
      handleValidationError(res, "Invoice ID is required", "id", operation);
      return null;
    }
    const invoiceId = parseInt(id, 10);
    if (isNaN(invoiceId)) {
      handleValidationError(res, "Invalid invoice ID", "id", operation);
      return null;
    }
    return invoiceId;
  }

  /**
   * Helper: Validate and get sub-dealer by phone
   * Returns sub-dealer ID if valid, null otherwise
   */
  private async validateSubdealer(
    phone: string | undefined,
    res: Response,
    operation: string
  ): Promise<number | null> {
    if (!phone) {
      handleValidationError(
        res,
        "Phone number is required",
        "phone",
        operation
      );
      return null;
    }

    // Validate phone number format
    if (!isValidPhone(phone)) {
      handleValidationError(
        res,
        "Invalid phone number format. Please provide a valid Indian phone number",
        "phone",
        operation
      );
      return null;
    }

    // Normalize phone number (remove +91, 91 prefix if present)
    const normalizedPhone = phone.trim().replace(/^(\+91|91)/, "");

    // Find sub-dealer by phone
    const subdealer = await prisma.subdealer.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!subdealer) {
      handleValidationError(
        res,
        "Sub-dealer not found with the provided phone number",
        "phone",
        operation
      );
      return null;
    }

    return subdealer.id;
  }

  /**
   * Helper: Upload invoice file (PDF or image) to S3
   */
  private async uploadInvoiceFile(
    file: any,
    subdealerId: number,
    res: Response,
    operation: string
  ): Promise<string | undefined> {
    try {
      // Validate file
      if (!file) {
        handleValidationError(res, "File is required", "file", operation);
        return undefined;
      }

      // Validate file type (PDF or image - JPEG, PNG only)
      const allowedMimeTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        handleValidationError(
          res,
          "Only PDF and image files (JPEG, PNG) are allowed",
          "file",
          operation
        );
        return undefined;
      }

      // Generate filename using subdealer ID
      const filename = `invoice-${subdealerId}`;

      // Upload to S3 using generic S3 service
      // Invoices (PDFs and images) are kept private for security
      const result = await uploadToS3(file.buffer, {
        folder: "invoices",
        filename: filename,
        contentType: file.mimetype,
        publicRead: false, // Invoices should be private
      });

      return result.publicUrl;
    } catch (uploadError) {
      handleError(uploadError, res, "Upload invoice file");
      return undefined;
    }
  }

  /**
   * Helper: Delete invoice file from S3 (with error handling)
   */
  private async deleteInvoiceFile(
    fileUrl: string | null | undefined
  ): Promise<void> {
    if (!fileUrl) return;

    try {
      await deleteFromS3ByUrl(fileUrl);
    } catch (deleteError) {
      console.warn("Failed to delete invoice file from S3:", deleteError);
      // Don't throw - allow operation to continue even if file deletion fails
    }
  }

  /**
   * Helper: Get invoice include options (for queries that return invoices)
   */
  private getInvoiceIncludeOptions() {
    return {
      include: {
        subdealer: {
          select: {
            id: true,
            phone: true,
            gstNumber: true,
            legalName: true,
            tradeName: true,
            email: true,
          },
        },
      },
    };
  }

  /**
   * Upload invoice (sub-dealer only)
   * POST /api/invoices
   */
  async uploadInvoice(req: Request, res: Response) {
    try {
      const { phone } = req.body;
      const file = (req as any).file;

      // Validate sub-dealer
      const subdealerId = await this.validateSubdealer(
        phone,
        res,
        "Upload invoice"
      );
      if (subdealerId === null) return;

      // Upload file to S3
      const fileUrl = await this.uploadInvoiceFile(
        file,
        subdealerId,
        res,
        "Upload invoice"
      );
      if (fileUrl === undefined) return; // Error already handled in uploadInvoiceFile

      // Create invoice record
      const invoice = await prisma.invoice.create({
        data: {
          pdfUrl: fileUrl, // Store URL (can be PDF or image)
          uploadedBy: subdealerId,
        },
        ...this.getInvoiceIncludeOptions(),
      });

      return res.status(201).json({
        success: true,
        message: "Invoice uploaded successfully",
        data: invoice,
      });
    } catch (error) {
      handleError(error, res, "Upload invoice");
    }
  }

  /**
   * Get all invoices (ADMIN only)
   * GET /api/invoices
   */
  async getAllInvoices(req: Request, res: Response) {
    try {
      const { subdealerId, page, limit } = req.query;

      // Build where clause for filtering
      const whereClause: any = {};

      // Filter by sub-dealer if provided
      if (subdealerId) {
        const subdealerIdNum = parseInt(subdealerId as string, 10);
        if (!isNaN(subdealerIdNum)) {
          whereClause.uploadedBy = subdealerIdNum;
        }
      }

      // Pagination
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 50;
      const skip = (pageNum - 1) * limitNum;

      // Get invoices with pagination
      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where: whereClause,
          ...this.getInvoiceIncludeOptions(),
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limitNum,
        }),
        prisma.invoice.count({
          where: whereClause,
        }),
      ]);

      return res.json({
        success: true,
        data: invoices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      handleError(error, res, "Get all invoices");
    }
  }

  /**
   * Get invoice by ID (ADMIN only)
   * GET /api/invoices/:id
   */
  async getInvoiceById(req: Request, res: Response) {
    try {
      const invoiceId = this.parseInvoiceId(req.params.id, res, "Get invoice");
      if (invoiceId === null) return;

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        ...this.getInvoiceIncludeOptions(),
      });

      if (!invoice) {
        return handleNotFoundError(res, "Invoice", "Get invoice");
      }

      return res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      handleError(error, res, "Get invoice");
    }
  }

  /**
   * Update invoice (ADMIN only)
   * PUT /api/invoices/:id
   */
  async updateInvoice(req: Request, res: Response) {
    try {
      const invoiceId = this.parseInvoiceId(
        req.params.id,
        res,
        "Update invoice"
      );
      if (invoiceId === null) return;

      const { uploadedBy } = req.body;
      const file = (req as any).file;

      // Check if invoice exists
      const existingInvoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!existingInvoice) {
        return handleNotFoundError(res, "Invoice", "Update invoice");
      }

      // Validate sub-dealer if provided
      let subdealerId: number | undefined;
      if (uploadedBy !== undefined) {
        const subdealerIdNum = parseInt(uploadedBy, 10);
        if (isNaN(subdealerIdNum)) {
          return handleValidationError(
            res,
            "Invalid sub-dealer ID",
            "uploadedBy",
            "Update invoice"
          );
        }

        // Verify sub-dealer exists
        const subdealer = await prisma.subdealer.findUnique({
          where: { id: subdealerIdNum },
        });

        if (!subdealer) {
          return handleNotFoundError(res, "Sub-dealer", "Update invoice");
        }

        subdealerId = subdealerIdNum;
      }

      // Handle file upload/update
      let fileUrl: string | undefined = existingInvoice.pdfUrl;
      if (file) {
        // Delete old file if exists
        await this.deleteInvoiceFile(existingInvoice.pdfUrl);

        // Upload new file
        const uploadSubdealerId = subdealerId || existingInvoice.uploadedBy;
        fileUrl = await this.uploadInvoiceFile(
          file,
          uploadSubdealerId,
          res,
          "Update invoice"
        );
        if (fileUrl === undefined) return; // Error already handled in uploadInvoiceFile
      }

      // Build update data
      const updateData: any = {};
      if (subdealerId !== undefined) updateData.uploadedBy = subdealerId;
      if (fileUrl !== undefined) updateData.pdfUrl = fileUrl;

      // Update invoice
      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: updateData,
        ...this.getInvoiceIncludeOptions(),
      });

      return res.json({
        success: true,
        message: "Invoice updated successfully",
        data: invoice,
      });
    } catch (error) {
      handleError(error, res, "Update invoice");
    }
  }

  /**
   * Delete invoice (ADMIN only)
   * DELETE /api/invoices/:id
   */
  async deleteInvoice(req: Request, res: Response) {
    try {
      const invoiceId = this.parseInvoiceId(
        req.params.id,
        res,
        "Delete invoice"
      );
      if (invoiceId === null) return;

      // Check if invoice exists
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        return handleNotFoundError(res, "Invoice", "Delete invoice");
      }

      // Delete file from S3 if exists
      await this.deleteInvoiceFile(invoice.pdfUrl);

      // Delete invoice from database
      await prisma.invoice.delete({
        where: { id: invoiceId },
      });

      return res.json({
        success: true,
        message: "Invoice deleted successfully",
      });
    } catch (error) {
      handleError(error, res, "Delete invoice");
    }
  }
}
