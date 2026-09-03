import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import {
  handleError,
  handleUnauthorizedError,
  handleForbiddenError,
  handleValidationError,
} from "../utils/error-handler.js";
import { buildFullName } from "../utils/name-helpers.js";
import {
  parseBoundedInteger,
  parsePositiveInteger,
} from "../utils/validators.js";

export class SalesController {
  async getMyLeads(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Get my leads"
        );
      }

      const userId = req.user.id;

      const page =
        req.query.page === undefined
          ? 1
          : parseBoundedInteger(req.query.page, 1, 1_000_000);
      const limit =
        req.query.limit === undefined
          ? 10
          : parseBoundedInteger(req.query.limit, 1, 100);
      if (page === null || limit === null) {
        return handleValidationError(
          res,
          "page must be positive and limit must be between 1 and 100",
          undefined,
          "Get my leads"
        );
      }
      const skip = (page - 1) * limit;

      const status = req.query.status as string | undefined;
      const source = req.query.source as string | undefined;

      const leadWhereClause: Prisma.LeadWhereInput = {
        ownerId: userId,
        deletedAt: null,
        enquiries: { some: { status: "UNRESOLVED" } },
      };

      if (status) {
        if (!Object.values(LeadStatus).includes(status as LeadStatus)) {
          return handleValidationError(
            res,
            "Invalid lead status",
            "status",
            "Get my leads"
          );
        }
        leadWhereClause.status = status as LeadStatus;
      }

      if (source) {
        if (!Object.values(LeadSource).includes(source as LeadSource)) {
          return handleValidationError(
            res,
            "Invalid lead source",
            "source",
            "Get my leads"
          );
        }
        leadWhereClause.source = source as LeadSource;
      }

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where: leadWhereClause,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
            remarks: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 100,
            },
            enquiries: {
              where: {
                status: "UNRESOLVED",
              },
              include: {
                landingPageCampaign: {
                  select: {
                    id: true,
                    name: true,
                    uniqueId: true,
                  },
                },
              },
              orderBy: {
                enquiryCreatedAt: "desc",
              },
            },
          },
        }),
        prisma.lead.count({ where: leadWhereClause }),
      ]);

      res.json({
        leads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      handleError(error, res, "Get my leads");
    }
  }

  async getLeadById(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Get lead by ID"
        );
      }

      const leadId = parsePositiveInteger(req.params.id);
      const userId = req.user.id;

      if (leadId === null) {
        return handleValidationError(
          res,
          "Invalid lead ID",
          "id",
          "Get lead by ID"
        );
      }

      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          ownerId: userId,
          deletedAt: null,
        },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          remarks: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          enquiries: {
            include: {
              landingPageCampaign: {
                select: {
                  id: true,
                  name: true,
                  uniqueId: true,
                },
              },
            },
            orderBy: {
              enquiryCreatedAt: "desc",
            },
          },
        },
      });

      if (!lead) {
        return handleForbiddenError(
          res,
          "Lead not found or not assigned to you",
          "Get lead by ID"
        );
      }

      res.json(lead);
    } catch (error) {
      handleError(error, res, "Get lead by ID");
    }
  }

  async qualifyLead(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Qualify lead"
        );
      }

      const leadId = parsePositiveInteger(req.params.id);
      const userId = req.user.id;

      if (leadId === null) {
        return handleValidationError(
          res,
          "Invalid lead ID",
          "id",
          "Qualify lead"
        );
      }

      const existingLead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          ownerId: userId,
          deletedAt: null,
        },
      });

      if (!existingLead) {
        return handleForbiddenError(
          res,
          "Lead not found or not assigned to you",
          "Qualify lead"
        );
      }

      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.QUALIFIED,
        },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      res.json({
        message: "Lead qualified successfully",
        lead: updatedLead,
      });
    } catch (error) {
      handleError(error, res, "Qualify lead");
    }
  }

  async disqualifyLead(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Disqualify lead"
        );
      }

      const leadId = parsePositiveInteger(req.params.id);
      const userId = req.user.id;

      if (leadId === null) {
        return handleValidationError(
          res,
          "Invalid lead ID",
          "id",
          "Disqualify lead"
        );
      }

      const existingLead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          ownerId: userId,
          deletedAt: null,
        },
      });

      if (!existingLead) {
        return handleForbiddenError(
          res,
          "Lead not found or not assigned to you",
          "Disqualify lead"
        );
      }

      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.UNQUALIFIED,
        },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      res.json({
        message: "Lead disqualified successfully",
        lead: updatedLead,
      });
    } catch (error) {
      handleError(error, res, "Disqualify lead");
    }
  }

  async addRemark(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Add remark"
        );
      }

      const leadId = parsePositiveInteger(req.params.id);
      const userId = req.user.id;
      const { remark } = req.body;

      if (leadId === null) {
        return handleValidationError(
          res,
          "Invalid lead ID",
          "id",
          "Add remark"
        );
      }

      if (
        typeof remark !== "string" ||
        remark.trim().length === 0 ||
        remark.trim().length > 5000
      ) {
        return handleValidationError(
          res,
          "Remark must be between 1 and 5000 characters",
          "remark",
          "Add remark"
        );
      }

      const existingLead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          ownerId: userId,
          deletedAt: null,
        },
      });

      if (!existingLead) {
        return handleForbiddenError(
          res,
          "Lead not found or not assigned to you",
          "Add remark"
        );
      }

      const newRemark = await prisma.leadRemark.create({
        data: {
          leadId,
          userId,
          remark: remark.trim(),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              status: true,
            },
          },
        },
      });

      const { lead: remarkLead, ...remarkFields } = newRemark;
      const remarkResponse = {
        ...remarkFields,
        lead: remarkLead
          ? {
              ...remarkLead,
              name: buildFullName(remarkLead.firstName, remarkLead.lastName),
            }
          : null,
      };

      res.status(201).json({
        message: "Remark added successfully",
        remark: remarkResponse,
      });
    } catch (error) {
      handleError(error, res, "Add remark");
    }
  }

  async getLeadRemarks(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Get lead remarks"
        );
      }

      const leadId = parsePositiveInteger(req.params.id);
      const userId = req.user.id;

      if (leadId === null) {
        return handleValidationError(
          res,
          "Invalid lead ID",
          "id",
          "Get lead remarks"
        );
      }

      const existingLead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          ownerId: userId,
          deletedAt: null,
        },
      });

      if (!existingLead) {
        return handleForbiddenError(
          res,
          "Lead not found or not assigned to you",
          "Get lead remarks"
        );
      }

      const remarks = await prisma.leadRemark.findMany({
        where: { leadId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 200,
      });

      res.json({ remarks });
    } catch (error) {
      handleError(error, res, "Get lead remarks");
    }
  }

  async resolveEnquiry(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Resolve enquiry"
        );
      }

      const enquiryId = parsePositiveInteger(req.params.id);
      const userId = req.user.id;

      if (enquiryId === null) {
        return handleValidationError(
          res,
          "Invalid enquiry ID",
          "id",
          "Resolve enquiry"
        );
      }

      const existingEnquiry = await prisma.enquiry.findFirst({
        where: {
          id: enquiryId,
          lead: {
            ownerId: userId,
            deletedAt: null,
          },
        },
      });

      if (!existingEnquiry) {
        return handleForbiddenError(
          res,
          "Enquiry not found or not assigned to you",
          "Resolve enquiry"
        );
      }

      const updatedEnquiry = await prisma.enquiry.update({
        where: { id: enquiryId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: userId,
        },
        include: {
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          landingPageCampaign: {
            select: {
              id: true,
              name: true,
              uniqueId: true,
            },
          },
        },
      });

      res.json({
        message: "Enquiry resolved successfully",
        enquiry: updatedEnquiry,
      });
    } catch (error) {
      handleError(error, res, "Resolve enquiry");
    }
  }

  async getMyStats(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Get my stats"
        );
      }

      const userId = req.user.id;

      const [
        totalLeads,
        qualifiedLeads,
        unqualifiedLeads,
        workingLeads,
        openLeads,
        convertedLeads,
        unresolvedEnquiries,
      ] = await Promise.all([
        prisma.lead.count({ where: { ownerId: userId, deletedAt: null } }),
        prisma.lead.count({
          where: {
            ownerId: userId,
            status: LeadStatus.QUALIFIED,
            deletedAt: null,
          },
        }),
        prisma.lead.count({
          where: {
            ownerId: userId,
            status: LeadStatus.UNQUALIFIED,
            deletedAt: null,
          },
        }),
        prisma.lead.count({
          where: {
            ownerId: userId,
            status: LeadStatus.WORKING,
            deletedAt: null,
          },
        }),
        prisma.lead.count({
          where: { ownerId: userId, status: LeadStatus.OPEN, deletedAt: null },
        }),
        prisma.lead.count({
          where: {
            ownerId: userId,
            deletedAt: null,
            OR: [
              { convertedToContactId: { not: null } },
              { status: LeadStatus.CONVERTED },
            ],
          },
        }),
        prisma.enquiry.count({
          where: {
            status: "UNRESOLVED",
            lead: {
              ownerId: userId,
              deletedAt: null,
            },
          },
        }),
      ]);

      res.json({
        stats: {
          totalLeads,
          qualifiedLeads,
          unqualifiedLeads,
          workingLeads,
          openLeads,
          convertedLeads,
          unresolvedEnquiries,
          conversionRate:
            totalLeads > 0
              ? ((convertedLeads / totalLeads) * 100).toFixed(2)
              : "0.00",
          qualificationRate:
            totalLeads > 0
              ? ((qualifiedLeads / totalLeads) * 100).toFixed(2)
              : "0.00",
        },
      });
    } catch (error) {
      handleError(error, res, "Get my stats");
    }
  }
}

export const salesController = new SalesController();
