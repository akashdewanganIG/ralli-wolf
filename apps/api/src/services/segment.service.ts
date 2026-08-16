import { prisma } from "@repo/db";
import {
  Prisma,
  Segment,
  SegmentRule,
  SegmentRuleType,
  SegmentEntityType,
} from "@prisma/client";

export type SegmentRuleOperator = "IN" | "NOT_IN";

export interface SegmentRuleInput {
  ruleType: SegmentRuleType;
  operator?: SegmentRuleOperator;
  value: Prisma.InputJsonValue | null;
}

export interface SegmentPayload {
  name: string;
  description?: string;
  entityType?: SegmentEntityType;
  logicOperator?: "AND" | "OR";
  rules: SegmentRuleInput[];
}

export class SegmentService {
  async listSegments() {
    return prisma.segment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        rules: true,
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        updater: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async getSegmentById(id: number) {
    return prisma.segment.findUnique({
      where: { id },
      include: {
        rules: true,
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        updater: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async createSegment(payload: SegmentPayload, userId: number) {
    const segment = await prisma.segment.create({
      data: {
        name: payload.name,
        description: payload.description,
        entityType: payload.entityType ?? SegmentEntityType.CONTACT,
        logicOperator: payload.logicOperator ?? "AND",
        filtersJson: (payload.rules ?? []) as unknown as Prisma.InputJsonValue,
        createdBy: userId,
        updatedBy: userId,
        rules: {
          create:
            payload.rules?.map(rule => ({
              ruleType: rule.ruleType,
              operator: rule.operator ?? "IN",
              value: rule.value === null ? Prisma.JsonNull : rule.value,
            })) ?? [],
        },
      },
      include: { rules: true },
    });

    return segment;
  }

  async updateSegment(id: number, payload: SegmentPayload, userId: number) {
    const segment = await prisma.segment.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description,
        entityType: payload.entityType ?? SegmentEntityType.CONTACT,
        logicOperator: payload.logicOperator ?? "AND",
        filtersJson: (payload.rules ?? []) as unknown as Prisma.InputJsonValue,
        updatedBy: userId,
        rules: {
          deleteMany: {},
          createMany: {
            data:
              payload.rules?.map(rule => ({
                ruleType: rule.ruleType,
                operator: rule.operator ?? "IN",
                value: rule.value === null ? Prisma.JsonNull : rule.value,
              })) ?? [],
          },
        },
      },
      include: { rules: true },
    });

    return segment;
  }

  async deleteSegment(id: number) {
    await prisma.segment.delete({ where: { id } });
  }

  async resolveSegmentContacts(segmentId: number, limit = 200) {
    const segment = await prisma.segment.findUnique({
      where: { id: segmentId },
      include: { rules: true },
    });

    if (!segment) {
      return null;
    }

    if (segment.entityType !== SegmentEntityType.CONTACT) {
      throw new Error("Segment entity type not supported yet");
    }

    const where = this.buildContactWhereClause(segment);

    const [rows, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          state: true,
          pincode: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      segment,
      contacts: rows,
      total,
    };
  }

  async getContactIds(segmentId: number) {
    const segment = await prisma.segment.findUnique({
      where: { id: segmentId },
      include: { rules: true },
    });

    if (!segment || segment.entityType !== SegmentEntityType.CONTACT) {
      return null;
    }

    const where = this.buildContactWhereClause(segment);
    const ids = await prisma.contact.findMany({
      where,
      select: { id: true },
    });
    return ids.map(row => row.id);
  }

  private buildContactWhereClause(
    segment: Segment & { rules: SegmentRule[] }
  ): Prisma.ContactWhereInput {
    if (!segment.rules?.length) {
      return {};
    }

    const clauses: Prisma.ContactWhereInput[] = [];

    for (const rule of segment.rules) {
      const clause = this.resolveRuleToWhere(rule);
      if (clause) {
        clauses.push(clause);
      }
    }

    if (!clauses.length) {
      return {};
    }

    const operator = (segment.logicOperator ?? "AND").toUpperCase();

    if (operator === "OR") {
      return { OR: clauses };
    }

    return { AND: clauses };
  }

  private resolveRuleToWhere(
    rule: SegmentRule
  ): Prisma.ContactWhereInput | null {
    switch (rule.ruleType) {
      case SegmentRuleType.KEYWORD:
        return this.buildKeywordClause(rule);
      case SegmentRuleType.CITY:
        return this.buildStringClause("city", rule);
      case SegmentRuleType.STATE:
        return this.buildStringClause("state", rule);
      case SegmentRuleType.PINCODE:
        return this.buildStringClause("pincode", rule);
      default:
        return null;
    }
  }

  private buildKeywordClause(
    rule: SegmentRule
  ): Prisma.ContactWhereInput | null {
    const values = this.parseNumberArray(rule.value);
    if (!values.length) {
      return null;
    }

    if ((rule.operator ?? "IN") === "NOT_IN") {
      return {
        keywords: {
          none: {
            keywordId: { in: values },
          },
        },
      };
    }

    return {
      keywords: {
        some: {
          keywordId: { in: values },
        },
      },
    };
  }

  private buildStringClause(
    field: "city" | "state" | "pincode",
    rule: SegmentRule
  ): Prisma.ContactWhereInput | null {
    const values = this.parseStringArray(rule.value);
    if (!values.length) {
      return null;
    }

    const valueClauses = values.map(val => ({
      [field]: {
        equals: val,
        mode: "insensitive",
      },
    }));

    if ((rule.operator ?? "IN") === "NOT_IN") {
      return { NOT: valueClauses };
    }

    if (valueClauses.length === 1) {
      return valueClauses[0] as Prisma.ContactWhereInput;
    }

    return { OR: valueClauses };
  }

  private parseNumberArray(value: Prisma.JsonValue | null): number[] {
    if (Array.isArray(value)) {
      return value
        .map(entry => {
          const num = typeof entry === "string" ? Number(entry) : entry;
          return typeof num === "number" && !Number.isNaN(num) ? num : null;
        })
        .filter((entry): entry is number => entry !== null);
    }
    if (typeof value === "number") {
      return [value];
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? [] : [parsed];
    }
    return [];
  }

  private parseStringArray(value: Prisma.JsonValue | null): string[] {
    if (Array.isArray(value)) {
      return value
        .map(entry =>
          typeof entry === "string"
            ? entry.trim()
            : typeof entry === "number"
              ? String(entry)
              : null
        )
        .filter((entry): entry is string => Boolean(entry));
    }
    if (typeof value === "string") {
      return [value.trim()].filter(Boolean);
    }
    if (typeof value === "number") {
      return [String(value)];
    }
    return [];
  }
}
