import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { handleError, handleValidationError } from "../utils/errorHandler.js";

export class OrderController {
  /**
   * Create a new order
   * POST /api/orders
   */
  async createOrder(req: Request, res: Response) {
    try {
      const { subdealerId, lineItems } = req.body as {
        subdealerId: number;
        lineItems: { productId: number; quantity: number }[];
      };

      if (!subdealerId) {
        return handleValidationError(
          res,
          "Subdealer ID is required",
          "subdealerId",
          "Create Order"
        );
      }

      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return handleValidationError(
          res,
          "Line items are required",
          "lineItems",
          "Create Order"
        );
      }

      // Validate subdealer exists
      const subdealer = await prisma.subdealer.findUnique({
        where: { id: subdealerId },
      });

      if (!subdealer) {
        return handleValidationError(
          res,
          "Subdealer not found",
          "subdealerId",
          "Create Order"
        );
      }

      // Calculate totals and validate products
      let totalAmount = 0;
      const orderLineItems: {
        productId: number;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }[] = [];

      for (const item of lineItems) {
        if (item.quantity <= 0) continue;

        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          return handleValidationError(
            res,
            `Product with ID ${item.productId} not found`,
            "lineItems",
            "Create Order"
          );
        }

        // Product doesn't have a price field - pricing is handled through PriceBookEntry
        // For now, default to 0. TODO: Fetch price from PriceBookEntry if priceBookId is provided
        const unitPrice = 0;
        const totalPrice = unitPrice * item.quantity;
        totalAmount += totalPrice;

        orderLineItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
        });
      }

      if (orderLineItems.length === 0) {
        return handleValidationError(
          res,
          "No valid items in order",
          "lineItems",
          "Create Order"
        );
      }

      // Create order in transaction
      const order = await prisma.$transaction(async tx => {
        // Generate order number (simple timestamp based for now)
        const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            totalAmount,
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
          },
        });

        return newOrder;
      });

      return res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: order,
      });
    } catch (error) {
      handleError(error, res, "Create Order");
    }
  }
}
