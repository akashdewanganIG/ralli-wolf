import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma, Region } from "@prisma/client";
import crypto from "crypto";
import { msg91Service } from "../services/msg91.service.js";
import { emailService } from "../services/email.service.js";
import { generateAakramanToken } from "../utils/jwt.utils.js";
import {
  getOrderCatalogueProducts,
  OrderPricingError,
  resolveOrderLines,
} from "../services/order-pricing.service.js";
import {
  nextDocumentNumber,
  SEQUENCE_KEYS,
} from "../services/supplyChain/numbering.service.js";
import { handleError, handleValidationError } from "../utils/error-handler.js";
import { logWarn } from "../utils/logger.js";
import {
  isValidEmail,
  parseBoundedInteger,
  parsePositiveInteger,
} from "../utils/validators.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const ORDER_PRODUCT_SELECT = {
  id: true,
  name: true,
  code: true,
  imageUrl: true,
  description: true,
  categoryId: true,
  active: true,
  component: true,
} satisfies Prisma.ProductSelect;

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOtp(otp: string): string {
  const secret = process.env.OTP_HASH_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error(
      "OTP_HASH_SECRET must contain at least 32 bytes of secret material"
    );
  }
  return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

const otpIssuedResponse = {
  success: true,
  message: "If an eligible account exists, a code has been sent",
  expiresIn: OTP_EXPIRY_MINUTES * 60,
};

interface OrderFirmDetails {
  firmName: string;
  ownerFirstName: string;
  ownerLastName: string;
  contactNumber: string;
  email?: string;
  city: string;
  state: string;
  pincode?: string;
  gst?: string;
}

interface OrderLineItem {
  productId: number;
  quantity: number;
}

export class AakramanController {
  async sendSmsOtp(req: Request, res: Response): Promise<void> {
    try {
      const { phone } = req.body;

      if (!phone || !/^\d{10}$/.test(phone)) {
        res
          .status(400)
          .json({ error: "Valid 10-digit phone number is required" });
        return;
      }

      const otp = generateOtp();
      const otpHash = hashOtp(otp);

      const user = await prisma.user.findFirst({
        where: {
          phone,
          deletedAt: null,
          role: { in: ["SALES", "ADMIN"] },
        },
      });

      if (!user) {
        res.json(otpIssuedResponse);
        return;
      }

      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      const record = await prisma.$transaction(async tx => {
        await tx.salesUserOTP.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        return tx.salesUserOTP.create({
          data: {
            userId: user.id,
            phone,
            otpHash,
            expiresAt,
          },
        });
      });

      const sent = await msg91Service.sendOtp(phone, otp);

      if (!sent) {
        await prisma.salesUserOTP.updateMany({
          where: { id: record.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        logWarn("aakraman_otp_delivery_failed", {
          channel: "sms",
          otpRecordId: record.id,
          userId: user.id,
        });
        res.status(503).json({
          error: "We could not send your code. Please try again in a moment.",
        });
        return;
      }

      res.json(otpIssuedResponse);
    } catch (error) {
      handleError(error, res, "Send Aakraman SMS OTP");
    }
  }

  async sendEmailOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: "Valid email is required" });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const otp = generateOtp();
      const otpHash = hashOtp(otp);

      const user = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          deletedAt: null,
          role: { in: ["SALES", "ADMIN"] },
        },
      });

      if (!user) {
        res.json(otpIssuedResponse);
        return;
      }

      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      const record = await prisma.$transaction(async tx => {
        await tx.salesUserOTP.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        return tx.salesUserOTP.create({
          data: {
            userId: user.id,
            phone: user.phone || "",
            otpHash,
            expiresAt,
          },
        });
      });

      const userName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || "User";
      const sent = await emailService.sendAakramanOtpEmail(
        user.email,
        userName,
        otp
      );

      if (!sent) {
        await prisma.salesUserOTP.updateMany({
          where: { id: record.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        logWarn("aakraman_otp_delivery_failed", {
          channel: "email",
          otpRecordId: record.id,
          userId: user.id,
        });
        res.status(503).json({
          error: "We could not email your code. Please try again in a moment.",
        });
        return;
      }

      res.json(otpIssuedResponse);
    } catch (error) {
      handleError(error, res, "Send Aakraman email OTP");
    }
  }

  async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const { phone, email, otp } = req.body;

      if (!otp || !/^\d{6}$/.test(otp)) {
        res.status(400).json({ error: "Valid 6-digit OTP is required" });
        return;
      }

      if (!phone && !email) {
        res.status(400).json({ error: "Phone or email is required" });
        return;
      }

      let user;
      if (phone) {
        user = await prisma.user.findFirst({
          where: {
            phone,
            deletedAt: null,
            role: { in: ["SALES", "ADMIN"] },
          },
        });
      } else {
        user = await prisma.user.findFirst({
          where: {
            email: String(email).trim().toLowerCase(),
            deletedAt: null,
            role: { in: ["SALES", "ADMIN"] },
          },
        });
      }

      if (!user) {
        res.status(401).json({ error: "Invalid or expired code" });
        return;
      }

      const otpRecord = await prisma.salesUserOTP.findFirst({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: MAX_OTP_ATTEMPTS },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!otpRecord) {
        res.status(401).json({ error: "Invalid or expired code" });
        return;
      }

      const inputOtpHash = hashOtp(otp);

      const inputHashBuffer = Buffer.from(inputOtpHash, "hex");
      const storedHashBuffer = Buffer.from(otpRecord.otpHash, "hex");
      const matches =
        inputHashBuffer.length === storedHashBuffer.length &&
        crypto.timingSafeEqual(inputHashBuffer, storedHashBuffer);

      if (!matches) {
        await prisma.salesUserOTP.updateMany({
          where: {
            id: otpRecord.id,
            usedAt: null,
            attempts: { lt: MAX_OTP_ATTEMPTS },
          },
          data: { attempts: { increment: 1 } },
        });
        res.status(401).json({ error: "Invalid or expired code" });
        return;
      }

      const claimed = await prisma.salesUserOTP.updateMany({
        where: {
          id: otpRecord.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: MAX_OTP_ATTEMPTS },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        res.status(401).json({ error: "Invalid or expired code" });
        return;
      }

      const token = generateAakramanToken(
        user.id,
        user.phone || "",
        user.email,
        user.sessionVersion
      );

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          region: user.region,
        },
      });
    } catch (error) {
      handleError(error, res, "Verify Aakraman OTP");
    }
  }

  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.salesUser?.userId;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          region: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({ user });
    } catch (error) {
      handleError(error, res, "Get Aakraman user");
    }
  }

  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const salesUserId = req.salesUser?.userId;

      if (!salesUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { firmDetails, lineItems } = req.body as {
        firmDetails: OrderFirmDetails;
        lineItems: OrderLineItem[];
      };

      if (!firmDetails) {
        res.status(400).json({ error: "Firm details are required" });
        return;
      }

      const {
        firmName,
        ownerFirstName,
        ownerLastName,
        contactNumber,
        email,
        city,
        state,
        pincode,
        gst,
      } = firmDetails;

      if (
        !firmName ||
        !ownerFirstName ||
        !ownerLastName ||
        !contactNumber ||
        !city ||
        !state
      ) {
        res.status(400).json({
          error:
            "Required firm details: firmName, ownerFirstName, ownerLastName, contactNumber, city, state",
        });
        return;
      }

      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        res.status(400).json({ error: "Line items are required" });
        return;
      }

      const priced = await resolveOrderLines(lineItems);

      const order = await prisma.$transaction(async tx => {
        const orderNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.AAKRAMAN_ORDER
        );

        const newOrder = await tx.order.create({
          data: {
            salesUserId,
            orderNumber,
            totalAmount: priced.totalAmount,
            firmName,
            ownerFirstName,
            ownerLastName,
            contactNumber,
            email: email || null,
            city,
            state,
            pincode: pincode || null,
            gst: gst || null,
            lineItems: {
              create: priced.lines,
            },
          },
          include: {
            lineItems: {
              include: {
                product: { select: ORDER_PRODUCT_SELECT },
              },
            },
            salesUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                region: true,
                location: true,
              },
            },
          },
        });

        return newOrder;
      });

      res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: order,
      });
    } catch (error) {
      if (error instanceof OrderPricingError) {
        res.status(422).json({ error: error.message });
        return;
      }
      handleError(error, res, "Create Aakraman order");
    }
  }

  async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const { search, categoryId } = req.query;

      let parsedCategoryId: number | undefined;
      if (categoryId) {
        const value = Number(categoryId);
        if (!Number.isSafeInteger(value) || value <= 0) {
          res.status(400).json({ error: "Category ID is invalid" });
          return;
        }
        parsedCategoryId = value;
      }

      if (search !== undefined && typeof search !== "string") {
        res.status(400).json({ error: "Search query is invalid" });
        return;
      }
      const pricedProducts = await getOrderCatalogueProducts({
        categoryId: parsedCategoryId,
        search: typeof search === "string" ? search : undefined,
      });

      const categories = await prisma.productCategory.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      });

      res.json({
        products: pricedProducts,
        categories,
      });
    } catch (error) {
      handleError(error, res, "Get Aakraman products");
    }
  }

  async getMyOrders(req: Request, res: Response): Promise<void> {
    try {
      const salesUserId = req.salesUser?.userId;

      if (!salesUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const orders = await prisma.order.findMany({
        where: { salesUserId },
        include: {
          lineItems: {
            include: {
              product: { select: ORDER_PRODUCT_SELECT },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ orders });
    } catch (error) {
      handleError(error, res, "Get Aakraman orders");
    }
  }

  async getAllOrders(req: Request, res: Response): Promise<void> {
    try {
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
          "Get all Aakraman orders"
        );
        return;
      }

      const skip = (page - 1) * limit;

      const { region, state, city, salesUserId, productId, search } = req.query;

      const where: Prisma.OrderWhereInput = {
        salesUserId: { not: null },
        archived: false,
      };

      if (region) {
        if (
          typeof region !== "string" ||
          !Object.values(Region).includes(region as Region)
        ) {
          handleValidationError(
            res,
            "Invalid region",
            "region",
            "Get all Aakraman orders"
          );
          return;
        }
        where.salesUser = { region: region as Region };
      }
      if (state) {
        if (typeof state !== "string" || state.trim().length > 100) {
          handleValidationError(res, "Invalid state", "state");
          return;
        }
        where.state = { equals: state.trim(), mode: "insensitive" };
      }
      if (city) {
        if (typeof city !== "string" || city.trim().length > 100) {
          handleValidationError(res, "Invalid city", "city");
          return;
        }
        where.city = { contains: city.trim(), mode: "insensitive" };
      }
      if (salesUserId) {
        const id = parsePositiveInteger(salesUserId);
        if (id === null) {
          handleValidationError(res, "Invalid sales user ID", "salesUserId");
          return;
        }
        where.salesUserId = id;
      }
      if (productId) {
        const id = parsePositiveInteger(productId);
        if (id === null) {
          handleValidationError(res, "Invalid product ID", "productId");
          return;
        }
        where.lineItems = {
          some: { productId: id },
        };
      }
      if (search !== undefined) {
        if (
          typeof search !== "string" ||
          !search.trim() ||
          search.trim().length > 200
        ) {
          handleValidationError(res, "Invalid search query", "search");
          return;
        }
        const term = search.trim();
        where.OR = [
          { orderNumber: { contains: term, mode: "insensitive" } },
          { firmName: { contains: term, mode: "insensitive" } },
          { ownerFirstName: { contains: term, mode: "insensitive" } },
          { ownerLastName: { contains: term, mode: "insensitive" } },
          { contactNumber: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
        ];
      }

      const totalItems = await prisma.order.count({ where });

      const orders = await prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          lineItems: {
            include: {
              product: { select: ORDER_PRODUCT_SELECT },
            },
          },
          salesUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              region: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      res.json({
        data: orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
      });
    } catch (error) {
      handleError(error, res, "Get all Aakraman orders");
    }
  }

  async getOrderById(req: Request, res: Response): Promise<void> {
    try {
      const id = parsePositiveInteger(req.params.id);
      if (id === null) {
        handleValidationError(res, "Invalid order ID", "id");
        return;
      }

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          lineItems: {
            include: {
              product: { select: ORDER_PRODUCT_SELECT },
            },
          },
          salesUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              region: true,
            },
          },
        },
      });

      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      res.json({ order });
    } catch (error) {
      handleError(error, res, "Get Aakraman order");
    }
  }

  async updateOrder(req: Request, res: Response): Promise<void> {
    try {
      const id = parsePositiveInteger(req.params.id);
      if (id === null) {
        handleValidationError(res, "Invalid order ID", "id");
        return;
      }
      const {
        firmName,
        ownerFirstName,
        ownerLastName,
        contactNumber,
        email,
        city,
        state,
        pincode,
      } = req.body;

      const fields = {
        firmName: { value: firmName, maximum: 255 },
        ownerFirstName: { value: ownerFirstName, maximum: 100 },
        ownerLastName: { value: ownerLastName, maximum: 100 },
        contactNumber: { value: contactNumber, maximum: 32 },
        email: { value: email, maximum: 254 },
        city: { value: city, maximum: 100 },
        state: { value: state, maximum: 100 },
        pincode: { value: pincode, maximum: 6 },
      } as const;
      if (Object.values(fields).every(field => field.value === undefined)) {
        handleValidationError(res, "At least one order field is required");
        return;
      }
      const data: Prisma.OrderUpdateInput = {};
      for (const [key, field] of Object.entries(fields)) {
        if (field.value === undefined) continue;
        if (
          field.value !== null &&
          (typeof field.value !== "string" ||
            field.value.trim().length > field.maximum)
        ) {
          handleValidationError(res, `Invalid ${key}`, key);
          return;
        }
        data[key as keyof typeof fields] =
          typeof field.value === "string" ? field.value.trim() || null : null;
      }
      if (typeof email === "string" && email.trim() && !isValidEmail(email)) {
        handleValidationError(res, "Invalid email address", "email");
        return;
      }
      if (
        typeof contactNumber === "string" &&
        contactNumber.trim() &&
        !/^[0-9+().\-\s]+$/.test(contactNumber.trim())
      ) {
        handleValidationError(res, "Invalid contact number", "contactNumber");
        return;
      }
      if (
        typeof pincode === "string" &&
        pincode.trim() &&
        !/^\d{6}$/.test(pincode.trim())
      ) {
        handleValidationError(res, "Pincode must contain 6 digits", "pincode");
        return;
      }

      const order = await prisma.order.update({
        where: { id },
        data,
        include: {
          lineItems: {
            include: {
              product: { select: ORDER_PRODUCT_SELECT },
            },
          },
          salesUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              region: true,
            },
          },
        },
      });

      res.json({ order });
    } catch (error) {
      handleError(error, res, "Update Aakraman order");
    }
  }

  async getSalesUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        where: {
          role: { in: ["SALES", "ADMIN"] },
          deletedAt: null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          region: true,
          location: true,
        },
        orderBy: { firstName: "asc" },
      });

      res.json({ users });
    } catch (error) {
      handleError(error, res, "Get Aakraman sales users");
    }
  }

  async archiveOrder(req: Request, res: Response): Promise<void> {
    try {
      const id = parsePositiveInteger(req.params.id);
      const userId = req.user?.id;
      if (id === null || !userId) {
        handleValidationError(res, "Invalid order or user ID", "id");
        return;
      }

      const order = await prisma.order.update({
        where: { id },
        data: {
          archived: true,
          archivedAt: new Date(),
          archivedBy: userId,
        },
        include: {
          lineItems: {
            include: {
              product: { select: ORDER_PRODUCT_SELECT },
            },
          },
          salesUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              region: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: "Order archived successfully",
        order,
      });
    } catch (error) {
      handleError(error, res, "Archive Aakraman order");
    }
  }

  async unarchiveOrder(req: Request, res: Response): Promise<void> {
    try {
      const id = parsePositiveInteger(req.params.id);
      if (id === null) {
        handleValidationError(res, "Invalid order ID", "id");
        return;
      }

      const order = await prisma.order.update({
        where: { id },
        data: {
          archived: false,
          archivedAt: null,
          archivedBy: null,
        },
        include: {
          lineItems: {
            include: {
              product: { select: ORDER_PRODUCT_SELECT },
            },
          },
          salesUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              region: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: "Order unarchived successfully",
        order,
      });
    } catch (error) {
      handleError(error, res, "Unarchive Aakraman order");
    }
  }
}

export const aakramanController = new AakramanController();
