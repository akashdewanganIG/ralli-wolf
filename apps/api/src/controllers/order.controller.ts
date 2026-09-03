import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { handleError, handleValidationError } from "../utils/error-handler.js";
import {
  OrderPricingError,
  resolveOrderLines,
} from "../services/order-pricing.service.js";
import {
  nextDocumentNumber,
  SEQUENCE_KEYS,
} from "../services/supplyChain/numbering.service.js";

export class OrderController {
  async createOrder(req: Request, res: Response) {
    try {
      const { lineItems } = req.body as {
        lineItems: { productId: number; quantity: number }[];
      };
      const subdealerId = req.subdealer?.id;

      if (!subdealerId) {
        return handleValidationError(
          res,
          "Authenticated subdealer is required",
          undefined,
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

      const priced = await resolveOrderLines(lineItems);

      const order = await prisma.$transaction(async tx => {
        const orderNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.CUSTOMER_ORDER
        );

        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            totalAmount: priced.totalAmount,
            subdealerId,
            lineItems: {
              create: priced.lines,
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
      if (error instanceof OrderPricingError) {
        return handleValidationError(
          res,
          error.message,
          "lineItems",
          "Create Order"
        );
      }
      handleError(error, res, "Create Order");
    }
  }
}
