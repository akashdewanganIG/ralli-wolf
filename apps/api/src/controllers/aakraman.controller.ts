import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { msg91Service } from "../services/msg91.service.js";
import { emailService } from "../services/email.service.js";

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

/**
 * Generate a 6-digit OTP
 */
function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash OTP for secure storage
 */
function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Generate JWT token for sales user
 */
function generateSalesUserToken(
  userId: number,
  phone: string,
  email: string
): string {
  return jwt.sign({ userId, phone, email, type: "sales_user" }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

/**
 * Verify sales user JWT token
 */
export function verifySalesUserToken(
  token: string
): { userId: number; phone: string; email: string; type: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      phone: string;
      email: string;
      type: string;
    };
    if (decoded.type !== "sales_user") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

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
  /**
   * Send OTP via SMS (MSG91)
   * POST /api/aakraman/send-otp/sms
   */
  async sendSmsOtp(req: Request, res: Response): Promise<void> {
    try {
      const { phone } = req.body;

      if (!phone || !/^\d{10}$/.test(phone)) {
        res
          .status(400)
          .json({ error: "Valid 10-digit phone number is required" });
        return;
      }

      // Check if user exists with this phone
      const user = await prisma.user.findFirst({
        where: {
          phone,
          deletedAt: null,
          role: { in: ["SALES", "ADMIN"] },
        },
      });

      if (!user) {
        res
          .status(404)
          .json({ error: "No sales user found with this phone number" });
        return;
      }

      // Generate OTP
      const otp = generateOtp();
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // Burn any code still outstanding for this user before minting another,
      // so only the most recently sent one can be redeemed.
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

      // Send OTP via MSG91
      const sent = await msg91Service.sendOtp(phone, otp);

      if (!sent) {
        // Burn the code rather than leave a live one nobody received, and say
        // so without printing the code: logs are not a place to keep a
        // credential that is still valid.
        await prisma.salesUserOTP.updateMany({
          where: { id: record.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        console.error("Aakraman SMS OTP delivery failed", {
          otpId: record.id,
          userId: user.id,
        });
        res.status(503).json({
          error: "We could not send your code. Please try again in a moment.",
        });
        return;
      }

      res.json({
        success: true,
        message: "OTP sent successfully",
        expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        // For development - remove in production
        ...(process.env.NODE_ENV === "development" && { devOtp: otp }),
      });
    } catch (error) {
      console.error("Error sending SMS OTP:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  }

  /**
   * Send OTP via email
   * POST /api/aakraman/send-otp/email
   */
  async sendEmailOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: "Valid email is required" });
        return;
      }

      // Check if user exists with this email
      const user = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          deletedAt: null,
          role: { in: ["SALES", "ADMIN"] },
        },
      });

      if (!user) {
        res.status(404).json({ error: "No sales user found with this email" });
        return;
      }

      // Generate OTP
      const otp = generateOtp();
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // Burn any code still outstanding for this user before minting another,
      // so only the most recently sent one can be redeemed.
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

      // Send the OTP by email
      const userName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || "User";
      const sent = await emailService.sendAakramanOtpEmail(
        user.email,
        userName,
        otp
      );

      if (!sent) {
        // Same rule as the SMS path: burn the code, and never log its value.
        await prisma.salesUserOTP.updateMany({
          where: { id: record.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        console.error("Aakraman email OTP delivery failed", {
          otpId: record.id,
          userId: user.id,
        });
        res.status(503).json({
          error: "We could not email your code. Please try again in a moment.",
        });
        return;
      }

      res.json({
        success: true,
        message: "OTP sent to your email",
        expiresIn: OTP_EXPIRY_MINUTES * 60,
        ...(process.env.NODE_ENV === "development" && { devOtp: otp }),
      });
    } catch (error) {
      console.error("Error sending Email OTP:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  }

  /**
   * Verify OTP and login
   * POST /api/aakraman/verify-otp
   */
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

      // Find user by phone or email
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
            email: email.toLowerCase(),
            deletedAt: null,
            role: { in: ["SALES", "ADMIN"] },
          },
        });
      }

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Find the latest valid OTP for this user
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
        res
          .status(400)
          .json({ error: "No valid OTP found. Please request a new one." });
        return;
      }

      // Verify OTP hash
      const inputOtpHash = hashOtp(otp);

      if (inputOtpHash !== otpRecord.otpHash) {
        // Increment attempts
        await prisma.salesUserOTP.update({
          where: { id: otpRecord.id },
          data: { attempts: otpRecord.attempts + 1 },
        });

        const remainingAttempts = MAX_OTP_ATTEMPTS - otpRecord.attempts - 1;
        res.status(400).json({
          error: "Invalid OTP",
          remainingAttempts: Math.max(0, remainingAttempts),
        });
        return;
      }

      // Mark OTP as used
      await prisma.salesUserOTP.update({
        where: { id: otpRecord.id },
        data: { usedAt: new Date() },
      });

      // Generate JWT token
      const token = generateSalesUserToken(
        user.id,
        user.phone || "",
        user.email
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
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  }

  /**
   * Get current user info
   * GET /api/aakraman/me
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).salesUser?.userId;

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
      console.error("Error getting current user:", error);
      res.status(500).json({ error: "Failed to get user info" });
    }
  }

  /**
   * Create order from sales user
   * POST /api/aakraman/orders
   */
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const salesUserId = (req as any).salesUser?.userId;

      if (!salesUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { firmDetails, lineItems } = req.body as {
        firmDetails: OrderFirmDetails;
        lineItems: OrderLineItem[];
      };

      // Validate firm details
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

      // Validate line items
      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        res.status(400).json({ error: "Line items are required" });
        return;
      }

      // Build order line items
      const orderLineItems: {
        productId: number;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }[] = [];

      let totalAmount = 0;

      for (const item of lineItems) {
        if (item.quantity <= 0) continue;

        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          res
            .status(400)
            .json({ error: `Product with ID ${item.productId} not found` });
          return;
        }

        // Product doesn't have a price field - pricing is handled through PriceBookEntry
        // For now, default to 0. TODO: Fetch price from PriceBookEntry if priceBookId is provided
        const unitPrice = 0;
        const itemTotal = unitPrice * item.quantity;
        totalAmount += itemTotal;

        orderLineItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          totalPrice: itemTotal,
        });
      }

      if (orderLineItems.length === 0) {
        res.status(400).json({ error: "No valid items in order" });
        return;
      }

      // Create order
      const order = await prisma.$transaction(async tx => {
        const orderNumber = `AKR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const newOrder = await tx.order.create({
          data: {
            salesUserId,
            orderNumber,
            totalAmount: totalAmount || null,
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
              create: orderLineItems,
            },
          },
          include: {
            lineItems: {
              include: {
                product: true,
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
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  }

  /**
   * Get products for ordering (active products only)
   * GET /api/aakraman/products
   */
  async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const { search, categoryId } = req.query;

      const where: any = { active: true };

      if (categoryId) {
        where.categoryId = Number(categoryId);
      }

      if (search && typeof search === "string") {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const products = await prisma.product.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      });

      const categories = await prisma.productCategory.findMany({
        orderBy: { name: "asc" },
      });

      res.json({
        products,
        categories,
      });
    } catch (error) {
      console.error("Error getting products:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  }

  /**
   * Get orders for current sales user
   * GET /api/aakraman/orders
   */
  async getMyOrders(req: Request, res: Response): Promise<void> {
    try {
      const salesUserId = (req as any).salesUser?.userId;

      if (!salesUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const orders = await prisma.order.findMany({
        where: { salesUserId },
        include: {
          lineItems: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ orders });
    } catch (error) {
      console.error("Error getting orders:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  }

  /**
   * Get all orders (admin only)
   * GET /api/aakraman/admin/orders
   */
  async getAllOrders(req: Request, res: Response): Promise<void> {
    try {
      // Extract and validate pagination parameters
      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;

      // Validate page parameter
      const page = Math.max(1, parseInt(pageParam) || 1);

      // Validate limit parameter with custom support
      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;

      // Calculate pagination offset
      const skip = (page - 1) * limit;

      const { region, state, city, salesUserId, productId, search } = req.query;

      const where: any = {
        salesUserId: { not: null }, // Only aakraman orders
        archived: false, // Filter out archived orders
      };

      // Apply filters
      if (region) {
        where.salesUser = { region: region as string };
      }
      if (state) {
        where.state = { equals: state as string, mode: "insensitive" };
      }
      if (city) {
        where.city = { contains: city as string, mode: "insensitive" };
      }
      if (salesUserId) {
        where.salesUserId = Number(salesUserId);
      }
      if (productId) {
        where.lineItems = {
          some: { productId: Number(productId) },
        };
      }
      if (search && typeof search === "string") {
        where.OR = [
          { orderNumber: { contains: search, mode: "insensitive" } },
          { firmName: { contains: search, mode: "insensitive" } },
          { ownerFirstName: { contains: search, mode: "insensitive" } },
          { ownerLastName: { contains: search, mode: "insensitive" } },
          { contactNumber: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }

      // Execute count query with filters
      const totalItems = await prisma.order.count({ where });

      // Execute paginated query with filters
      const orders = await prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          lineItems: {
            include: {
              product: true,
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

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      // Return standardized pagination response
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
      console.error("Error getting all orders:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  }

  /**
   * Get order by ID (admin only)
   * GET /api/aakraman/admin/orders/:id
   */
  async getOrderById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const order = await prisma.order.findUnique({
        where: { id: Number(id) },
        include: {
          lineItems: {
            include: {
              product: true,
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
      console.error("Error getting order:", error);
      res.status(500).json({ error: "Failed to get order" });
    }
  }

  /**
   * Update order (admin only)
   * PUT /api/aakraman/admin/orders/:id
   */
  async updateOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        status,
        firmName,
        ownerFirstName,
        ownerLastName,
        contactNumber,
        email,
        city,
        state,
        pincode,
      } = req.body;

      const order = await prisma.order.update({
        where: { id: Number(id) },
        data: {
          ...(status && { status }),
          ...(firmName && { firmName }),
          ...(ownerFirstName && { ownerFirstName }),
          ...(ownerLastName && { ownerLastName }),
          ...(contactNumber && { contactNumber }),
          ...(email !== undefined && { email }),
          ...(city && { city }),
          ...(state && { state }),
          ...(pincode !== undefined && { pincode }),
        },
        include: {
          lineItems: {
            include: {
              product: true,
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
      console.error("Error updating order:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  }

  /**
   * Get sales users list (for filter dropdown)
   * GET /api/aakraman/admin/sales-users
   */
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
      console.error("Error getting sales users:", error);
      res.status(500).json({ error: "Failed to get sales users" });
    }
  }

  /**
   * Archive an order (ADMIN only)
   * POST /api/aakraman/admin/orders/:id/archive
   */
  async archiveOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const order = await prisma.order.update({
        where: { id: Number(id) },
        data: {
          archived: true,
          archivedAt: new Date(),
          archivedBy: userId,
        },
        include: {
          lineItems: {
            include: {
              product: true,
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
      console.error("Error archiving order:", error);
      res.status(500).json({ error: "Failed to archive order" });
    }
  }

  /**
   * Unarchive an order (ADMIN only)
   * POST /api/aakraman/admin/orders/:id/unarchive
   */
  async unarchiveOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const order = await prisma.order.update({
        where: { id: Number(id) },
        data: {
          archived: false,
          archivedAt: null,
          archivedBy: null,
        },
        include: {
          lineItems: {
            include: {
              product: true,
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
      console.error("Error unarchiving order:", error);
      res.status(500).json({ error: "Failed to unarchive order" });
    }
  }
}

export const aakramanController = new AakramanController();
