import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { roleHasPermission } from "@repo/db/permissions";
import {
  ApprovalTargetObject,
  ApprovalStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/error-handler.js";
import { buildFullName } from "../utils/name-helpers.js";
import { emailService } from "../services/email.service.js";
import { NotificationType } from "@prisma/client";
import {
  createNotification,
  shouldSendEmail,
} from "./notification.controller.js";
import { logError } from "../utils/logger.js";
import {
  parseBoundedInteger,
  parsePositiveInteger,
} from "../utils/validators.js";

class ApprovalAlreadyActionedError extends Error {}

export class ApprovalController {
  private parseId(
    id: string | undefined,
    res: Response,
    label: string,
    operation: string
  ): number | null {
    const parsed = parsePositiveInteger(id);
    if (parsed === null) {
      handleValidationError(res, `Invalid ${label}`, "id", operation);
      return null;
    }
    return parsed;
  }

  private pagination(
    req: Request,
    res: Response,
    operation: string
  ): { page: number; limit: number; skip: number } | null {
    const page =
      req.query.page === undefined
        ? 1
        : parseBoundedInteger(req.query.page, 1, 1_000_000);
    const limit =
      req.query.limit === undefined
        ? 10
        : parseBoundedInteger(req.query.limit, 1, 100);
    if (page === null || limit === null) {
      handleValidationError(
        res,
        "page must be positive and limit must be between 1 and 100",
        undefined,
        operation
      );
      return null;
    }
    return { page, limit, skip: (page - 1) * limit };
  }

  async getAllApprovals(req: Request, res: Response) {
    const operation = "Get all approvals";
    try {
      const pagination = this.pagination(req, res, operation);
      if (!pagination) return;
      const { page, limit, skip } = pagination;

      const { status, targetObjectName } = req.query;

      const where: Prisma.ApprovalProcessWhereInput = {};

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
        where.status = status as ApprovalStatus;
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
        where.targetObjectName = targetObjectName as ApprovalTargetObject;
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

  async getApprovalById(req: Request, res: Response) {
    const operation = "Get approval by ID";
    try {
      const id = this.parseId(req.params.id, res, "approval ID", operation);
      if (id === null) return;

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

  async getMyApprovals(req: Request, res: Response) {
    const operation = "Get my approvals";
    try {
      const userId = req.user!.id;
      const pagination = this.pagination(req, res, operation);
      if (!pagination) return;
      const { page, limit, skip } = pagination;

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

      const where: Prisma.ApprovalProcessWhereInput = {};

      if (type === "pending_for_me") {
        where.requestedToId = userId;
      } else if (type === "raised_by_me") {
        where.createdById = userId;
      } else {
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
        where.status = status as ApprovalStatus;
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
        where.targetObjectName = targetObjectName as ApprovalTargetObject;
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

  async createApproval(req: Request, res: Response) {
    const operation = "Create approval request";
    try {
      const userId = req.user!.id;
      const { targetObjectName, targetRecordId, requestedToId, comment } =
        req.body;

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

      if (
        comment !== undefined &&
        comment !== null &&
        (typeof comment !== "string" || comment.trim().length > 5_000)
      ) {
        return handleValidationError(
          res,
          "comment must be text of at most 5000 characters",
          "comment",
          operation
        );
      }

      const parsedRecordId = parsePositiveInteger(targetRecordId);
      if (parsedRecordId === null) {
        return handleValidationError(
          res,
          "Invalid targetRecordId",
          "targetRecordId",
          operation
        );
      }

      const parsedRequestedToId = parsePositiveInteger(requestedToId);
      if (parsedRequestedToId === null) {
        return handleValidationError(
          res,
          "Invalid requestedToId",
          "requestedToId",
          operation
        );
      }
      if (parsedRequestedToId === userId) {
        return handleValidationError(
          res,
          "An approval request must be assigned to a different user",
          "requestedToId",
          operation
        );
      }

      const approver = await prisma.user.findUnique({
        where: { id: parsedRequestedToId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          permissions: true,
          deletedAt: true,
        },
      });
      if (!approver) {
        return handleNotFoundError(res, "Approver user", operation);
      }
      if (
        approver.deletedAt !== null ||
        !roleHasPermission(approver.role, approver.permissions, "approvals.act")
      ) {
        return handleValidationError(
          res,
          "Approver must be active and have approval permission",
          "requestedToId",
          operation
        );
      }

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
            status: true,
          },
        });
        if (!opportunity || opportunity.deletedAt) {
          return handleNotFoundError(res, "Opportunity", operation);
        }
        if (!["DRAFT", "REJECTED"].includes(opportunity.status)) {
          return handleValidationError(
            res,
            `Opportunity is not in an approvable state. Current status: ${opportunity.status}`,
            "targetRecordId",
            operation
          );
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

      const approval = await prisma.$transaction(async tx => {
        const newApproval = await tx.approvalProcess.create({
          data: {
            targetObjectName,
            targetRecordId: parsedRecordId,
            requestedToId: parsedRequestedToId,
            createdById: userId,
            comment:
              typeof comment === "string" ? comment.trim() || null : null,
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

        if (targetObjectName === "OPP") {
          await tx.opportunity.update({
            where: { id: parsedRecordId },
            data: { status: "SUBMITTED" },
          });
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

      const requester = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
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

        emailHandledByCaller: true,
      }).catch(err => logError("approval_notification_create_failed", err));

      void shouldSendEmail(parsedRequestedToId, "APPROVAL_REQUESTED")
        .then(allowed => {
          if (!allowed) return;
          return emailService
            .sendApprovalRequestEmail({
              approverName: buildFullName(
                approver.firstName,
                approver.lastName
              ),
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
            .catch(err => logError("approval_request_email_failed", err));
        })
        .catch(err => logError("approval_email_preference_lookup_failed", err));

      return res.status(201).json({ data: approval });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

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
      if (
        comment !== undefined &&
        comment !== null &&
        (typeof comment !== "string" || comment.trim().length > 5_000)
      ) {
        return handleValidationError(
          res,
          "comment must be text of at most 5000 characters",
          "comment",
          operation
        );
      }
      const normalizedComment =
        typeof comment === "string" ? comment.trim() || null : null;

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

      if (
        !(
          ["OPP", "QUOTE", "PURCHASE_ORDER"] as ApprovalTargetObject[]
        ).includes(approval.targetObjectName)
      ) {
        return res.status(422).json({
          error: `Approval target ${approval.targetObjectName} is not supported by this workflow`,
          code: "UNSUPPORTED_APPROVAL_TARGET",
        });
      }

      if (approval.createdById === userId) {
        return res.status(403).json({
          error: "Requesters cannot approve or reject their own requests",
          code: "SELF_APPROVAL_FORBIDDEN",
        });
      }

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
        const decision = await tx.approvalProcess.updateMany({
          where: { id: approvalId, status: "PENDING" },
          data: {
            status: newStatus,
            lastActorId: userId,
            comment: normalizedComment ?? approval.comment,
            completedDate: new Date(),
          },
        });
        if (decision.count !== 1) {
          throw new ApprovalAlreadyActionedError();
        }

        if (approval.targetObjectName === "OPP") {
          objectType = "Opportunity";
          const opp = await tx.opportunity.findUnique({
            where: { id: approval.targetRecordId },
            select: { name: true, opportunityNumber: true },
          });
          objectName = opp?.name ?? "";
          objectNumber = opp?.opportunityNumber ?? "";

          await tx.opportunity.update({
            where: { id: approval.targetRecordId },
            data: {
              status: newStatus === "APPROVED" ? "APPROVED" : "REJECTED",
            },
          });

          await tx.opportunityActivity.create({
            data: {
              opportunityId: approval.targetRecordId,
              userId,
              activityType: newStatus === "APPROVED" ? "APPROVED" : "REJECTED",
              description:
                newStatus === "APPROVED"
                  ? `Approved by ${buildFullName(actor?.firstName ?? null, actor?.lastName ?? null)}`
                  : `Rejected by ${buildFullName(actor?.firstName ?? null, actor?.lastName ?? null)}${normalizedComment ? `: ${normalizedComment}` : ""}`,
              newValue: newStatus,
            },
          });
        } else if (approval.targetObjectName === "PURCHASE_ORDER") {
          objectType = "Purchase Order";

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
        } else if (approval.targetObjectName === "QUOTE") {
          objectType = "Quote";
          const quote = await tx.quote.update({
            where: { id: approval.targetRecordId },
            data: {
              status: newStatus === "APPROVED" ? "APPROVED" : "REJECTED",
              ...(newStatus === "APPROVED"
                ? {
                    approvedAt: new Date(),
                    approvedById: userId,
                    approvalComment: normalizedComment,
                  }
                : {
                    rejectedAt: new Date(),
                    rejectedById: userId,
                    rejectionComment: normalizedComment,
                  }),
            },
            select: { name: true, quoteNumber: true },
          });
          objectName = quote.name;
          objectNumber = quote.quoteNumber;
        } else {
          throw new Error("Unsupported approval target");
        }
      });

      const isPurchaseOrder = approval.targetObjectName === "PURCHASE_ORDER";
      const decisionType: NotificationType =
        newStatus === "APPROVED"
          ? "PURCHASE_ORDER_APPROVED"
          : "PURCHASE_ORDER_REJECTED";

      if (isPurchaseOrder) {
        createNotification({
          userId: approval.createdById,
          type: decisionType,
          title: `Purchase Order ${objectNumber} ${newStatus === "APPROVED" ? "approved" : "rejected"}`,
          message:
            newStatus === "APPROVED"
              ? `${buildFullName(actor?.firstName ?? null, actor?.lastName ?? null)} approved ${objectNumber}. It can now be sent to the supplier.`
              : `${buildFullName(actor?.firstName ?? null, actor?.lastName ?? null)} rejected ${objectNumber}${normalizedComment ? `: ${normalizedComment}` : ""}.`,
          link: `/purchasing/orders/${approval.targetRecordId}`,

          emailHandledByCaller: true,
        }).catch(err => logError("approval_notification_create_failed", err));
      }

      const decisionEmailAllowed = isPurchaseOrder
        ? await shouldSendEmail(approval.createdById, decisionType)
        : true;

      if (decisionEmailAllowed) {
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
          .catch(err => logError("approval_action_email_failed", err));
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
      if (error instanceof ApprovalAlreadyActionedError) {
        return res.status(409).json({
          error: "Approval has already been actioned",
          code: "APPROVAL_ALREADY_ACTIONED",
        });
      }
      handleError(error, res, operation);
    }
  }
}
