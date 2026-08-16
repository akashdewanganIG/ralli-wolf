import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { ApprovalTargetObject, ApprovalStatus, UserRole } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/errorHandler.js";
import { buildFullName } from "../utils/nameHelpers.js";
import { emailService } from "../services/email.service.js";
import { createNotification } from "./notification.controller.js";

export class ApprovalController {
  private parseId(
    id: string | undefined,
    res: Response,
    label: string,
    operation: string
  ): number | null {
    if (!id) {
      handleValidationError(res, `${label} is required`, "id", operation);
      return null;
    }
    const parsed = parseInt(id, 10);
    if (isNaN(parsed)) {
      handleValidationError(res, `Invalid ${label}`, "id", operation);
      return null;
    }
    return parsed;
  }

  /**
   * GET /api/approvals
   * Get all approvals in the system (ADMIN only)
   * Query params: status, targetObjectName, page, limit
   */
  async getAllApprovals(req: Request, res: Response) {
    const operation = "Get all approvals";
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const requestedLimit = parseInt(req.query.limit as string);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;
      const skip = (page - 1) * limit;

      const { status, targetObjectName } = req.query;

      const where: any = {};

      if (status) {
        const valid: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED"];
        if (!valid.includes(status as ApprovalStatus)) {
          return handleValidationError(
            res,
            `Invalid status. Must be one of: ${valid.join(", ")}`,
            "status",
            operation
          );
        }
        where.status = status;
      }

      if (targetObjectName) {
        const valid: ApprovalTargetObject[] = [
          "OPP",
          "QUOTE",
          "PURCHASE_ORDER",
        ];
        if (!valid.includes(targetObjectName as ApprovalTargetObject)) {
          return handleValidationError(
            res,
            `Invalid targetObjectName. Must be one of: ${valid.join(", ")}`,
            "targetObjectName",
            operation
          );
        }
        where.targetObjectName = targetObjectName;
      }

      const [totalItems, approvals] = await Promise.all([
        prisma.approvalProcess.count({ where }),
        prisma.approvalProcess.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            requestedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            lastActor: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalItems / limit);
      return res.json({
        data: approvals,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  /**
   * GET /api/approvals/:id
   * Get a single approval by ID
   */
  async getApprovalById(req: Request, res: Response) {
    const operation = "Get approval by ID";
    try {
      const id = parseInt(req.params.id ?? "", 10);
      if (isNaN(id))
        return handleValidationError(
          res,
          "Invalid approval ID",
          "id",
          operation
        );

      const approval = await prisma.approvalProcess.findUnique({
        where: { id },
        include: {
          requestedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          lastActor: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!approval) return handleNotFoundError(res, "Approval", operation);

      return res.json({ data: approval });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  /**
   * GET /api/approvals/my
   * Get approvals for the current user
   * Query params: type (pending_for_me | raised_by_me | all), status, page, limit
   */
  async getMyApprovals(req: Request, res: Response) {
    const operation = "Get my approvals";
    try {
      const userId = req.user!.id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const requestedLimit = parseInt(req.query.limit as string);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;
      const skip = (page - 1) * limit;

      const type = (req.query.type as string) || "all";
      const { status, targetObjectName } = req.query;

      const validTypes = ["pending_for_me", "raised_by_me", "all"];
      if (!validTypes.includes(type)) {
        return handleValidationError(
          res,
          `Invalid type. Must be one of: ${validTypes.join(", ")}`,
          "type",
          operation
        );
      }

      const where: any = {};

      if (type === "pending_for_me") {
        where.requestedToId = userId;
      } else if (type === "raised_by_me") {
        where.createdById = userId;
      } else {
        // all: either assigned to me or raised by me
        where.OR = [{ requestedToId: userId }, { createdById: userId }];
      }

      if (status) {
        const valid: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED"];
        if (!valid.includes(status as ApprovalStatus)) {
          return handleValidationError(
            res,
            `Invalid status. Must be one of: ${valid.join(", ")}`,
            "status",
            operation
          );
        }
        where.status = status;
      }

      if (targetObjectName) {
        const valid: ApprovalTargetObject[] = [
          "OPP",
          "QUOTE",
          "PURCHASE_ORDER",
        ];
        if (!valid.includes(targetObjectName as ApprovalTargetObject)) {
          return handleValidationError(
            res,
            `Invalid targetObjectName. Must be one of: ${valid.join(", ")}`,
            "targetObjectName",
            operation
          );
        }
        where.targetObjectName = targetObjectName;
      }

      const [totalItems, approvals] = await Promise.all([
        prisma.approvalProcess.count({ where }),
        prisma.approvalProcess.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            requestedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            lastActor: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalItems / limit);
      return res.json({
        data: approvals,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  /**
   * POST /api/approvals
   * Manually raise an approval request (ADMIN only)
   * Body: { targetObjectName, targetRecordId, requestedToId, comment? }
   */
  async createApproval(req: Request, res: Response) {
    const operation = "Create approval request";
    try {
      const userId = req.user!.id;
      const { targetObjectName, targetRecordId, requestedToId, comment } =
        req.body;

      // Validate required fields
      if (!targetObjectName || !targetRecordId || !requestedToId) {
        return handleValidationError(
          res,
          "targetObjectName, targetRecordId, and requestedToId are required",
          "body",
          operation
        );
      }

      const validTargets: ApprovalTargetObject[] = [
        "OPP",
        "QUOTE",
        "PURCHASE_ORDER",
      ];
      if (!validTargets.includes(targetObjectName)) {
        return handleValidationError(
          res,
          `Invalid targetObjectName. Must be one of: ${validTargets.join(", ")}`,
          "targetObjectName",
          operation
        );
      }

      const parsedRecordId = parseInt(targetRecordId, 10);
      if (isNaN(parsedRecordId)) {
        return handleValidationError(
          res,
          "Invalid targetRecordId",
          "targetRecordId",
          operation
        );
      }

      const parsedRequestedToId = parseInt(requestedToId, 10);
      if (isNaN(parsedRequestedToId)) {
        return handleValidationError(
          res,
          "Invalid requestedToId",
          "requestedToId",
          operation
        );
      }

      // Validate the approver exists and has admin role
      const approver = await prisma.user.findUnique({
        where: { id: parsedRequestedToId },
      });
      if (!approver) {
        return handleNotFoundError(res, "Approver user", operation);
      }
      if (approver.role === UserRole.SALES) {
        return handleValidationError(
          res,
          "Approver must have the ADMIN role",
          "requestedToId",
          operation
        );
      }

      // Validate the target record exists and is in an approvable state
      let objectName = "";
      let objectNumber = "";

      if (targetObjectName === "OPP") {
        const opportunity = await prisma.opportunity.findUnique({
          where: { id: parsedRecordId },
          select: {
            id: true,
            name: true,
            opportunityNumber: true,
            deletedAt: true,
          },
        });
        if (!opportunity || opportunity.deletedAt) {
          return handleNotFoundError(res, "Opportunity", operation);
        }
        objectName = opportunity.name;
        objectNumber = opportunity.opportunityNumber;
      } else if (targetObjectName === "PURCHASE_ORDER") {
        const purchaseOrder = await prisma.purchaseOrder.findUnique({
          where: { id: parsedRecordId },
          select: {
            id: true,
            poNumber: true,
            status: true,
            supplier: { select: { name: true } },
          },
        });
        if (!purchaseOrder) {
          return handleNotFoundError(res, "Purchase order", operation);
        }
        if (
          purchaseOrder.status !== "DRAFT" &&
          purchaseOrder.status !== "REJECTED"
        ) {
          return handleValidationError(
            res,
            `Purchase order is not in an approvable state. Current status: ${purchaseOrder.status}`,
            "targetRecordId",
            operation
          );
        }
        objectName = `Purchase order for ${purchaseOrder.supplier.name}`;
        objectNumber = purchaseOrder.poNumber;
      } else {
        const quote = await prisma.quote.findUnique({
          where: { id: parsedRecordId },
          select: { id: true, name: true, quoteNumber: true, status: true },
        });
        if (!quote) {
          return handleNotFoundError(res, "Quote", operation);
        }
        if (quote.status !== "DRAFT") {
          return handleValidationError(
            res,
            `Quote is not in an approvable state. Current status: ${quote.status}`,
            "targetRecordId",
            operation
          );
        }
        objectName = quote.name;
        objectNumber = quote.quoteNumber;
      }

      // Check for existing PENDING approval for this record
      const existingApproval = await prisma.approvalProcess.findFirst({
        where: {
          targetObjectName,
          targetRecordId: parsedRecordId,
          status: "PENDING",
        },
      });
      if (existingApproval) {
        return res.status(409).json({
          error: "A pending approval already exists for this record",
          code: "APPROVAL_EXISTS",
          approvalId: existingApproval.id,
        });
      }

      // Create approval and update record status in a transaction
      const approval = await prisma.$transaction(async tx => {
        const newApproval = await tx.approvalProcess.create({
          data: {
            targetObjectName,
            targetRecordId: parsedRecordId,
            requestedToId: parsedRequestedToId,
            createdById: userId,
            comment: comment || null,
          },
          include: {
            requestedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        // Update record status to reflect pending approval
        if (targetObjectName === "OPP") {
          await tx.opportunityActivity.create({
            data: {
              opportunityId: parsedRecordId,
              userId,
              activityType: "SUBMITTED_FOR_APPROVAL",
              description: `Submitted for approval to ${buildFullName(approver.firstName, approver.lastName)}`,
            },
          });
        } else if (targetObjectName === "PURCHASE_ORDER") {
          await tx.purchaseOrder.update({
            where: { id: parsedRecordId },
            data: { status: "PENDING_APPROVAL" },
          });
        } else {
          await tx.quote.update({
            where: { id: parsedRecordId },
            data: { status: "IN_REVIEW" },
          });
        }

        return newApproval;
      });

      // Send in-app notification to the assigned approver (fire-and-forget)
      const requester = await prisma.user.findUnique({ where: { id: userId } });
      const requesterName = buildFullName(
        requester?.firstName ?? null,
        requester?.lastName ?? null
      );
      const objectLabel =
        targetObjectName === "OPP"
          ? "Opportunity"
          : targetObjectName === "PURCHASE_ORDER"
            ? "Purchase Order"
            : "Quote";
      const objectLink =
        targetObjectName === "OPP"
          ? `/sales/opportunities/${parsedRecordId}`
          : targetObjectName === "PURCHASE_ORDER"
            ? `/purchasing/orders/${parsedRecordId}`
            : `/sales/quotes/${parsedRecordId}`;
      createNotification({
        userId: parsedRequestedToId,
        type: "APPROVAL_REQUESTED",
        title: `Approval Requested — ${objectLabel} ${objectNumber}`,
        message: `${requesterName} has submitted ${objectName} for your approval.`,
        link: objectLink,
      }).catch(err =>
        console.error("[Approval] Failed to create notification:", err)
      );

      // Send notification email to approver (fire-and-forget)
      emailService
        .sendApprovalRequestEmail({
          approverName: buildFullName(approver.firstName, approver.lastName),
          approverEmail: approver.email,
          requesterName: buildFullName(
            requester?.firstName ?? null,
            requester?.lastName ?? null
          ),
          objectType: objectLabel,
          objectName,
          objectNumber,
          approvalId: approval.id,
        })
        .catch(err =>
          console.error(
            "[Approval] Failed to send approval request email:",
            err
          )
        );

      return res.status(201).json({ data: approval });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  /**
   * PATCH /api/approvals/:id/action
   * Approve or reject an approval request (ADMIN only)
   * Body: { action: 'APPROVE' | 'REJECT', comment? }
   * Only the assigned approver (requestedTo) or an admin can act
   */
  async actionApproval(req: Request, res: Response) {
    const operation = "Action on approval";
    try {
      const approvalId = this.parseId(
        req.params.id,
        res,
        "Approval ID",
        operation
      );
      if (approvalId === null) return;

      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { action, comment } = req.body;

      if (!action || !["APPROVE", "REJECT"].includes(action)) {
        return handleValidationError(
          res,
          "action must be 'APPROVE' or 'REJECT'",
          "action",
          operation
        );
      }

      const approval = await prisma.approvalProcess.findUnique({
        where: { id: approvalId },
        include: {
          requestedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (!approval) {
        return handleNotFoundError(res, "Approval", operation);
      }

      if (approval.status !== "PENDING") {
        return handleValidationError(
          res,
          `Approval is already ${approval.status}. Only PENDING approvals can be actioned.`,
          "status",
          operation
        );
      }

      // Only the assigned approver or an admin can act
      if (approval.requestedToId !== userId && userRole !== UserRole.ADMIN) {
        return res.status(403).json({
          error:
            "You are not authorized to action this approval. Only the assigned approver or an admin can act.",
        });
      }

      const newStatus: ApprovalStatus =
        action === "APPROVE" ? "APPROVED" : "REJECTED";
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true },
      });

      let objectName = "";
      let objectNumber = "";
      let objectType: "Opportunity" | "Quote" | "Purchase Order" =
        "Opportunity";

      await prisma.$transaction(async tx => {
        // Update approval record
        await tx.approvalProcess.update({
          where: { id: approvalId },
          data: {
            status: newStatus,
            lastActorId: userId,
            comment: comment || approval.comment,
            completedDate: new Date(),
          },
        });

        // Sync status on the target record
        if (approval.targetObjectName === "OPP") {
          objectType = "Opportunity";
          const opp = await tx.opportunity.findUnique({
            where: { id: approval.targetRecordId },
            select: { name: true, opportunityNumber: true },
          });
          objectName = opp?.name ?? "";
          objectNumber = opp?.opportunityNumber ?? "";

          await tx.opportunityActivity.create({
            data: {
              opportunityId: approval.targetRecordId,
              userId,
              activityType: newStatus === "APPROVED" ? "APPROVED" : "REJECTED",
              description:
                newStatus === "APPROVED"
                  ? `Approved by ${buildFullName(actor?.firstName ?? null, actor?.lastName ?? null)}`
                  : `Rejected by ${buildFullName(actor?.firstName ?? null, actor?.lastName ?? null)}${comment ? `: ${comment}` : ""}`,
              newValue: newStatus,
            },
          });
        } else if (approval.targetObjectName === "PURCHASE_ORDER") {
          objectType = "Purchase Order";
          // An approved order becomes committable spend; a rejected one goes
          // back to the buyer so it can be corrected and resubmitted.
          const purchaseOrder = await tx.purchaseOrder.update({
            where: { id: approval.targetRecordId },
            data:
              newStatus === "APPROVED"
                ? {
                    status: "APPROVED",
                    approvedById: userId,
                    approvedAt: new Date(),
                  }
                : { status: "REJECTED" },
            select: { poNumber: true, supplier: { select: { name: true } } },
          });
          objectName = `Purchase order for ${purchaseOrder.supplier.name}`;
          objectNumber = purchaseOrder.poNumber;

          await tx.auditLog.create({
            data: {
              entityType: "PurchaseOrder",
              entityId: approval.targetRecordId,
              changedBy: userId,
              action: newStatus === "APPROVED" ? "APPROVE" : "REJECT",
              category: "PROCUREMENT",
              newValues: {
                status: newStatus === "APPROVED" ? "APPROVED" : "REJECTED",
                approvalId,
              },
            },
          });
        } else {
          objectType = "Quote";
          const quote = await tx.quote.update({
            where: { id: approval.targetRecordId },
            data: {
              // When an approval is APPROVED, quote moves to ACCEPTED (ready for order generation).
              // When REJECTED, quote moves to REJECTED.
              status: newStatus === "APPROVED" ? "ACCEPTED" : "REJECTED",
              ...(newStatus === "APPROVED"
                ? {
                    approvedAt: new Date(),
                    approvedById: userId,
                    approvalComment: comment || null,
                    acceptedAt: new Date(),
                  }
                : {
                    rejectedAt: new Date(),
                    rejectedById: userId,
                    rejectionComment: comment || null,
                  }),
            },
            select: { name: true, quoteNumber: true },
          });
          objectName = quote.name;
          objectNumber = quote.quoteNumber;
        }
      });

      // Send notification email to requester (fire-and-forget)
      emailService
        .sendApprovalActionEmail({
          requesterName: buildFullName(
            approval.createdBy.firstName,
            approval.createdBy.lastName
          ),
          requesterEmail: approval.createdBy.email,
          actorName: buildFullName(
            actor?.firstName ?? null,
            actor?.lastName ?? null
          ),
          action: newStatus,
          objectType,
          objectName,
          objectNumber,
          comment: comment || undefined,
        })
        .catch(err =>
          console.error("[Approval] Failed to send approval action email:", err)
        );

      // Purchase approvals gate real spend, so the buyer is told in-app as
      // well as by email — waiting on an inbox delays the order going out.
      if (approval.targetObjectName === "PURCHASE_ORDER") {
        createNotification({
          userId: approval.createdById,
          type:
            newStatus === "APPROVED"
              ? "PURCHASE_ORDER_APPROVED"
              : "PURCHASE_ORDER_REJECTED",
          title: `Purchase Order ${objectNumber} ${newStatus === "APPROVED" ? "approved" : "rejected"}`,
          message:
            newStatus === "APPROVED"
              ? `${buildFullName(actor?.firstName ?? null, actor?.lastName ?? null)} approved ${objectNumber}. It can now be sent to the supplier.`
              : `${buildFullName(actor?.firstName ?? null, actor?.lastName ?? null)} rejected ${objectNumber}${comment ? `: ${comment}` : ""}.`,
          link: `/purchasing/orders/${approval.targetRecordId}`,
        }).catch(err =>
          console.error("[Approval] Failed to create notification:", err)
        );
      }

      const updated = await prisma.approvalProcess.findUnique({
        where: { id: approvalId },
        include: {
          requestedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          lastActor: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return res.json({ data: updated });
    } catch (error) {
      handleError(error, res, operation);
    }
  }
}
