import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { handleError } from "../utils/error-handler.js";
import { LeadSource, LeadStatus } from "@prisma/client";

const leadSourceLabels: Record<LeadSource, string> = {
  [LeadSource.MANUAL]: "Manual",
  [LeadSource.IMPORT]: "Import",
  [LeadSource.LANDING_PAGE]: "Landing Page",
};

function getLeadSourceLabel(source: LeadSource | null | undefined): string {
  if (!source) return "Unknown";
  return leadSourceLabels[source] || source;
}

export class DashboardController {
  async getLeadsGeneratedOverTime(req: Request, res: Response) {
    try {
      const { period = "week", startDate, endDate } = req.query;

      const now = new Date();
      let start: Date,
        end: Date = now;

      if (period === "week") {
        start = new Date(now);
        start.setUTCDate(start.getUTCDate() - 6);
        start.setUTCHours(0, 0, 0, 0);
      } else if (period === "month") {
        start = new Date(now);
        start.setUTCDate(start.getUTCDate() - 29);
        start.setUTCHours(0, 0, 0, 0);
      } else if (startDate && endDate) {
        start = new Date(startDate as string);
        end = new Date(endDate as string);
      } else {
        start = new Date(now);
        start.setUTCDate(start.getUTCDate() - 6);
        start.setUTCHours(0, 0, 0, 0);
      }

      const leadsInRange = await prisma.lead.findMany({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
          deletedAt: null,
        },
        select: { createdAt: true },
        orderBy: {
          createdAt: "asc",
        },
      });
      const countsByDay = new Map<string, number>();
      leadsInRange.forEach(lead => {
        const key = lead.createdAt.toISOString().slice(0, 10);
        countsByDay.set(key, (countsByDay.get(key) || 0) + 1);
      });

      const chartData = {
        labels: [] as string[],
        datasets: [
          {
            label: "Leads Generated",
            data: [] as number[],
            borderColor: "#fbce28",
            backgroundColor: "rgba(251, 206, 40, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      };

      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dayLabel = currentDate.toLocaleDateString("en-US", {
          weekday: "short",
          timeZone: "UTC",
        });
        const dayCount =
          countsByDay.get(currentDate.toISOString().slice(0, 10)) || 0;

        chartData.labels.push(dayLabel);
        if (chartData.datasets[0]) {
          chartData.datasets[0].data.push(dayCount);
        }

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      res.json(chartData);
    } catch (error) {
      handleError(error, res, "Get dashboard summary");
    }
  }

  async getConversionRate(req: Request, res: Response) {
    try {
      const totalLeads = await prisma.lead.count({
        where: {
          deletedAt: null,
        },
      });

      const convertedLeads = await prisma.lead.count({
        where: {
          OR: [
            { convertedToContactId: { not: null } },
            { status: LeadStatus.CONVERTED },
          ],
          deletedAt: null,
        },
      });

      const notConvertedLeads = totalLeads - convertedLeads;

      const chartData = {
        labels: ["Converted", "Not Converted"],
        datasets: [
          {
            data: [convertedLeads, notConvertedLeads],
            backgroundColor: ["#fde047", "#E5E7EB"],
            borderColor: ["#fde047", "#E5E7EB"],
            borderWidth: 0,
          },
        ],
      };

      res.json(chartData);
    } catch (error) {
      handleError(error, res, "Get lead statistics");
    }
  }

  async getLeadSources(req: Request, res: Response) {
    try {
      const leadsBySource = await prisma.lead.groupBy({
        by: ["source"],
        where: {
          deletedAt: null,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: "desc",
          },
        },
      });

      const chartData = {
        labels: [] as string[],
        datasets: [
          {
            data: [] as number[],
            backgroundColor: ["#fbce28", "#fbbf24", "#f59e0b"],
            borderColor: ["#fbce28", "#fbbf24", "#f59e0b"],
            borderWidth: 0,
          },
        ],
      };

      leadsBySource.forEach(source => {
        chartData.labels.push(getLeadSourceLabel(source.source));
        if (chartData.datasets[0]) {
          chartData.datasets[0].data.push(source._count.id);
        }
      });

      res.json(chartData);
    } catch (error) {
      handleError(error, res, "Get recent activities");
    }
  }

  async getKeyMetrics(req: Request, res: Response) {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalLeadsCurrent,
        totalLeadsLastMonth,
        landingSignupsCurrent,
        landingSignupsLastMonth,
        activeCampaignsCurrent,
        activeCampaignsLastMonth,
        emailOpensCurrent,
        emailOpensLastMonth,
        whatsappEngagementsCurrent,
        whatsappEngagementsLastMonth,
        chatbotInteractionsCurrent,
        chatbotInteractionsLastMonth,
      ] = await Promise.all([
        prisma.lead.count({
          where: {
            createdAt: {
              gte: thisMonth,
            },
            deletedAt: null,
          },
        }),
        prisma.lead.count({
          where: {
            createdAt: {
              gte: lastMonth,
              lt: thisMonth,
            },
            deletedAt: null,
          },
        }),

        prisma.formSubmission.count({
          where: {
            submittedAt: {
              gte: thisMonth,
            },
          },
        }),
        prisma.formSubmission.count({
          where: {
            submittedAt: {
              gte: lastMonth,
              lt: thisMonth,
            },
          },
        }),

        prisma.campaign.count({
          where: {
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        }),
        prisma.campaign.count({
          where: {
            createdAt: {
              gte: lastMonth,
              lt: thisMonth,
            },
          },
        }),

        prisma.analyticsEvent.count({
          where: {
            eventType: "email_open",
            occurredAt: {
              gte: thisMonth,
            },
          },
        }),
        prisma.analyticsEvent.count({
          where: {
            eventType: "email_open",
            occurredAt: {
              gte: lastMonth,
              lt: thisMonth,
            },
          },
        }),

        prisma.analyticsEvent.count({
          where: {
            eventType: {
              contains: "whatsapp",
            },
            occurredAt: {
              gte: thisMonth,
            },
          },
        }),
        prisma.analyticsEvent.count({
          where: {
            eventType: {
              contains: "whatsapp",
            },
            occurredAt: {
              gte: lastMonth,
              lt: thisMonth,
            },
          },
        }),

        prisma.botSession.count({
          where: {
            startedAt: {
              gte: thisMonth,
            },
          },
        }),
        prisma.botSession.count({
          where: {
            startedAt: {
              gte: lastMonth,
              lt: thisMonth,
            },
          },
        }),
      ]);

      const calculateChange = (
        current: number,
        previous: number
      ): { change: string; changeType: "positive" | "negative" } => {
        if (previous === 0) {
          return current > 0
            ? { change: "+100%", changeType: "positive" }
            : { change: "0%", changeType: "positive" };
        }
        const percentage = Math.round(((current - previous) / previous) * 100);
        return {
          change: `${percentage >= 0 ? "+" : ""}${percentage}%`,
          changeType: percentage >= 0 ? "positive" : "negative",
        };
      };

      const metrics = [
        {
          title: "Total Leads",
          value: totalLeadsCurrent.toLocaleString(),
          ...calculateChange(totalLeadsCurrent, totalLeadsLastMonth),
        },
        {
          title: "Landing Signups",
          value: landingSignupsCurrent.toLocaleString(),
          ...calculateChange(landingSignupsCurrent, landingSignupsLastMonth),
        },
        {
          title: "Active Campaigns",
          value: activeCampaignsCurrent.toLocaleString(),
          ...calculateChange(activeCampaignsCurrent, activeCampaignsLastMonth),
        },
        {
          title: "Email Opens",
          value: emailOpensCurrent.toLocaleString(),
          ...calculateChange(emailOpensCurrent, emailOpensLastMonth),
        },
        {
          title: "WhatsApp Engagements",
          value: whatsappEngagementsCurrent.toLocaleString(),
          ...calculateChange(
            whatsappEngagementsCurrent,
            whatsappEngagementsLastMonth
          ),
        },
        {
          title: "Chatbot Interactions",
          value: chatbotInteractionsCurrent.toLocaleString(),
          ...calculateChange(
            chatbotInteractionsCurrent,
            chatbotInteractionsLastMonth
          ),
        },
      ];

      res.json(metrics);
    } catch (error) {
      handleError(error, res, "Get sales performance");
    }
  }
}
