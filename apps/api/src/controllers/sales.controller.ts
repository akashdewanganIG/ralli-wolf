import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { LeadStatus } from "@prisma/client";
import {
  handleError,
  handleUnauthorizedError,
  handleForbiddenError,
  handleValidationError,
} from "../utils/errorHandler.js";
import { buildFullName } from "../utils/nameHelpers.js";

/**
 * Sales Controller
 * Handles all sales-specific operations
 * Sales users can only:
 * 1. View leads assigned to them
 * 2. Qualify or Disqualify leads
 * 3. Add remarks to leads
 */
export class SalesController {
  /**
   * Get all leads assigned to the current sales user
   */
  async getMyLeads(req: Request, res: Response) {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Get my leads"
        );
      }

      const userId = req.user.id;

      // Parse query parameters for pagination
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Parse filters
      const status = req.query.status as string | undefined;
      const source = req.query.source as string | undefined;

      // Build lead where clause for filtering
      const leadWhereClause: any = {
        ownerId: userId,
        deletedAt: null,
      };

      if (status) {
        leadWhereClause.status = status;
      }

      if (source) {
        leadWhereClause.source = source;
      }

      // Get leads with unresolved enquiries
      const leadsWithEnquiries = await prisma.enquiry.findMany({
        where: {
          status: "UNRESOLVED",
          lead: leadWhereClause,
        },
        include: {
          lead: {
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
                where: {
                  status: "UNRESOLVED",
                },
                orderBy: {
                  enquiryCreatedAt: "desc",
                },
              },
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
        orderBy: {
          enquiryCreatedAt: "desc",
        },
        skip,
        take: limit,
      });

      // Get unique leads (in case a lead has multiple enquiries)
      const uniqueLeadsMap = new Map<number, any>();
      leadsWithEnquiries.forEach((enquiry: any) => {
        if (!uniqueLeadsMap.has(enquiry.lead.id)) {
          uniqueLeadsMap.set(enquiry.lead.id, enquiry.lead);
        }
      });
      const leads = Array.from(uniqueLeadsMap.values());

      // Get total count
      const total = await prisma.lead.count({
        where: {
          ...leadWhereClause,
          enquiries: {
            some: {
              status: "UNRESOLVED",
            },
          },
        },
      });

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

  /**
   * Get a specific lead (only if assigned to this sales user)
   */
  async getLeadById(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Get lead by ID"
        );
      }

      const idParam = req.params.id;
      const leadId = parseInt(idParam as string);
      const userId = req.user.id;

      if (isNaN(leadId)) {
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
          ownerId: userId, // Ensure lead is assigned to this user
          deletedAt: null, // Exclude deleted leads
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

  /**
   * Qualify a lead (change status to QUALIFIED)
   */
  async qualifyLead(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Qualify lead"
        );
      }

      const idParam = req.params.id;
      const leadId = parseInt(idParam as string);
      const userId = req.user.id;

      if (isNaN(leadId)) {
        return handleValidationError(
          res,
          "Invalid lead ID",
          "id",
          "Qualify lead"
        );
      }

      // Check if lead exists and is assigned to this user
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

      // Update lead status to QUALIFIED
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

  /**
   * Disqualify a lead (change status to UNQUALIFIED)
   */
  async disqualifyLead(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Disqualify lead"
        );
      }

      const idParam = req.params.id;
      const leadId = parseInt(idParam as string);
      const userId = req.user.id;

      if (isNaN(leadId)) {
        return handleValidationError(
          res,
          "Invalid lead ID",
          "id",
          "Disqualify lead"
        );
      }

      // Check if lead exists and is assigned to this user
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

      // Update lead status to UNQUALIFIED
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
      console.error("Error disqualifying lead:", error);
      handleError(error, res, "Disqualify lead");
    }
  }

  /**
   * Add a remark/note to a lead
   */
  async addRemark(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Add remark"
        );
      }

      const idParam = req.params.id;
      const leadId = parseInt(idParam as string);
      const userId = req.user.id;
      const { remark } = req.body;

      if (isNaN(leadId)) {
        return handleValidationError(
          res,
          "Invalid lead ID",
          "id",
          "Add remark"
        );
      }

      if (!remark || remark.trim().length === 0) {
        return handleValidationError(
          res,
          "Remark cannot be empty",
          "remark",
          "Add remark"
        );
      }

      // Check if lead exists and is assigned to this user
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

      // Create remark
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

      const remarkLead = (newRemark as any).lead;
      const remarkResponse = {
        ...newRemark,
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
      console.error("Error adding remark:", error);
      handleError(error, res, "Add remark");
    }
  }

  /**
   * Get all remarks for a specific lead
   */
  async getLeadRemarks(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Get lead remarks"
        );
      }

      const leadId = parseInt(String(req.params.id));
      const userId = req.user.id;

      if (isNaN(leadId)) {
        return handleValidationError(
          res,
          "Invalid lead ID",
          "id",
          "Get lead remarks"
        );
      }

      // Check if lead exists and is assigned to this user
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

      // Get all remarks for this lead
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
      });

      res.json({ remarks });
    } catch (error) {
      console.error("Error fetching remarks:", error);
      handleError(error, res, "Get lead remarks");
    }
  }

  /**
   * Resolve an enquiry
   */
  async resolveEnquiry(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Resolve enquiry"
        );
      }

      const enquiryId = parseInt(String(req.params.id));
      const userId = req.user.id;

      if (isNaN(enquiryId)) {
        return handleValidationError(
          res,
          "Invalid enquiry ID",
          "id",
          "Resolve enquiry"
        );
      }

      // Check if enquiry exists and belongs to a lead assigned to this user
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

      // Update enquiry status to RESOLVED
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
      console.error("Error resolving enquiry:", error);
      handleError(error, res, "Resolve enquiry");
    }
  }

  /**
   * Get statistics for the sales user's leads
   */
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

      // Get counts by status (excluding deleted leads)
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
      console.error("Error fetching stats:", error);
      handleError(error, res, "Get my stats");
    }
  }
}

export const salesController = new SalesController();
