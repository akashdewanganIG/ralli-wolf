import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/error-handler.js";
import {
  uploadToS3,
  deleteFromS3,
  extractS3KeyFromReference,
  getSignedS3DownloadUrl,
  type S3UploadResult,
} from "../services/s3.service.js";
import { verifyFileContent } from "../utils/file-validation.js";
import { logError } from "../utils/logger.js";
import { parseBoundedInteger } from "../utils/validators.js";

const INVOICE_FILE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export class InvoiceController {
  private parseInvoiceId(
    id: string | undefined,
    res: Response,
    operation: string
  ): number | null {
    if (!id) {
      handleValidationError(res, "Invoice ID is required", "id", operation);
      return null;
    }
    const invoiceId = Number(id);
    if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) {
      handleValidationError(res, "Invalid invoice ID", "id", operation);
      return null;
    }
    return invoiceId;
  }

  private async uploadInvoiceFile(
    file: Express.Multer.File | undefined,
    subdealerId: number,
    res: Response,
    operation: string
  ): Promise<S3UploadResult | undefined> {
    try {
      if (!file) {
        handleValidationError(res, "File is required", "file", operation);
        return undefined;
      }

      const verified = verifyFileContent(
        file.buffer,
        file.mimetype,
        INVOICE_FILE_MIME_TYPES
      );
      if (!verified) {
        handleValidationError(
          res,
          "File content must be a valid PDF, JPEG, or PNG",
          "file",
          operation
        );
        return undefined;
      }

      const filename = `invoice-${subdealerId}`;

      return await uploadToS3(file.buffer, {
        folder: "invoices",
        filename: filename,
        contentType: verified.mimeType,
        publicRead: false,
      });
    } catch (uploadError) {
      handleError(uploadError, res, "Upload invoice file");
      return undefined;
    }
  }

  private async deleteInvoiceFile(
    fileReference: string | null | undefined
  ): Promise<void> {
    if (!fileReference) return;

    try {
      const key = extractS3KeyFromReference(fileReference);
      if (!key?.startsWith("invoices/")) {
        logError(
          "invoice_file_reference_invalid",
          new Error("Invalid reference")
        );
        return;
      }
      await deleteFromS3(key);
    } catch (deleteError) {
      logError("invoice_file_cleanup_failed", deleteError);
    }
  }

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

  private toInvoiceResponse<T extends { id: number; pdfUrl: string }>(
    invoice: T
  ) {
    const { pdfUrl, ...safeInvoice } = invoice;
    return {
      ...safeInvoice,
      fileAvailable: Boolean(pdfUrl),
      downloadUrl: `/api/invoices/${invoice.id}/file`,
    };
  }

  async uploadInvoice(req: Request, res: Response) {
    let uploadedFile: S3UploadResult | undefined;
    try {
      const file = req.file;
      const subdealerId = req.subdealer?.id;
      if (!subdealerId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      uploadedFile = await this.uploadInvoiceFile(
        file,
        subdealerId,
        res,
        "Upload invoice"
      );
      if (!uploadedFile) return;

      const invoice = await prisma.invoice.create({
        data: {
          pdfUrl: `s3://${uploadedFile.key}`,
          uploadedBy: subdealerId,
        },
        ...this.getInvoiceIncludeOptions(),
      });
      uploadedFile = undefined;

      return res.status(201).json({
        success: true,
        message: "Invoice uploaded successfully",
        data: this.toInvoiceResponse(invoice),
      });
    } catch (error) {
      if (uploadedFile) {
        await this.deleteInvoiceFile(`s3://${uploadedFile.key}`);
      }
      handleError(error, res, "Upload invoice");
    }
  }

  async getAllInvoices(req: Request, res: Response) {
    try {
      const { subdealerId, page, limit } = req.query;

      const whereClause: Prisma.InvoiceWhereInput = {};

      if (subdealerId) {
        const subdealerIdNum = parseBoundedInteger(
          subdealerId,
          1,
          2_147_483_647
        );
        if (subdealerIdNum === null) {
          return handleValidationError(
            res,
            "Invalid sub-dealer ID",
            "subdealerId",
            "Get all invoices"
          );
        }
        whereClause.uploadedBy = subdealerIdNum;
      }

      const pageNum =
        page === undefined ? 1 : parseBoundedInteger(page, 1, 1_000_000);
      const limitNum =
        limit === undefined ? 50 : parseBoundedInteger(limit, 1, 100);
      if (pageNum === null || limitNum === null) {
        return handleValidationError(
          res,
          "page must be positive and limit must be between 1 and 100",
          undefined,
          "Get all invoices"
        );
      }
      const skip = (pageNum - 1) * limitNum;

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
        data: invoices.map(invoice => this.toInvoiceResponse(invoice)),
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
        data: this.toInvoiceResponse(invoice),
      });
    } catch (error) {
      handleError(error, res, "Get invoice");
    }
  }

  async downloadInvoiceFile(req: Request, res: Response) {
    try {
      const invoiceId = this.parseInvoiceId(
        req.params.id,
        res,
        "Download invoice"
      );
      if (invoiceId === null) return;

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { pdfUrl: true },
      });
      if (!invoice) {
        return handleNotFoundError(res, "Invoice", "Download invoice");
      }
      const key = extractS3KeyFromReference(invoice.pdfUrl);
      if (!key?.startsWith("invoices/")) {
        throw new Error("Invoice has an invalid storage reference");
      }
      const signedUrl = await getSignedS3DownloadUrl(key, 300);
      res.setHeader("Cache-Control", "private, no-store");
      return res.redirect(302, signedUrl);
    } catch (error) {
      handleError(error, res, "Download invoice");
    }
  }

  async updateInvoice(req: Request, res: Response) {
    let uploadedFile: S3UploadResult | undefined;
    try {
      const invoiceId = this.parseInvoiceId(
        req.params.id,
        res,
        "Update invoice"
      );
      if (invoiceId === null) return;

      const { uploadedBy } = req.body;
      const file = req.file;

      const existingInvoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!existingInvoice) {
        return handleNotFoundError(res, "Invoice", "Update invoice");
      }

      let subdealerId: number | undefined;
      if (uploadedBy !== undefined) {
        const subdealerIdNum = parseBoundedInteger(
          uploadedBy,
          1,
          2_147_483_647
        );
        if (subdealerIdNum === null) {
          return handleValidationError(
            res,
            "Invalid sub-dealer ID",
            "uploadedBy",
            "Update invoice"
          );
        }

        const subdealer = await prisma.subdealer.findUnique({
          where: { id: subdealerIdNum },
          select: { id: true },
        });

        if (!subdealer) {
          return handleNotFoundError(res, "Sub-dealer", "Update invoice");
        }

        subdealerId = subdealerIdNum;
      }

      if (!file && subdealerId === undefined) {
        return handleValidationError(
          res,
          "Provide a replacement file or uploadedBy",
          undefined,
          "Update invoice"
        );
      }

      if (file) {
        const uploadSubdealerId = subdealerId || existingInvoice.uploadedBy;
        uploadedFile = await this.uploadInvoiceFile(
          file,
          uploadSubdealerId,
          res,
          "Update invoice"
        );
        if (!uploadedFile) return;
      }

      const updateData: Prisma.InvoiceUncheckedUpdateInput = {};
      if (subdealerId !== undefined) updateData.uploadedBy = subdealerId;
      if (uploadedFile) updateData.pdfUrl = `s3://${uploadedFile.key}`;

      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: updateData,
        ...this.getInvoiceIncludeOptions(),
      });
      uploadedFile = undefined;

      if (file) {
        await this.deleteInvoiceFile(existingInvoice.pdfUrl);
      }

      return res.json({
        success: true,
        message: "Invoice updated successfully",
        data: this.toInvoiceResponse(invoice),
      });
    } catch (error) {
      if (uploadedFile) {
        await this.deleteInvoiceFile(`s3://${uploadedFile.key}`);
      }
      handleError(error, res, "Update invoice");
    }
  }

  async deleteInvoice(req: Request, res: Response) {
    try {
      const invoiceId = this.parseInvoiceId(
        req.params.id,
        res,
        "Delete invoice"
      );
      if (invoiceId === null) return;

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        return handleNotFoundError(res, "Invoice", "Delete invoice");
      }

      await prisma.invoice.delete({
        where: { id: invoiceId },
      });

      await this.deleteInvoiceFile(invoice.pdfUrl);

      return res.json({
        success: true,
        message: "Invoice deleted successfully",
      });
    } catch (error) {
      handleError(error, res, "Delete invoice");
    }
  }
}
