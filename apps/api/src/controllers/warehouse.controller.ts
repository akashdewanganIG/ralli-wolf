import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { BinType, PalletStatus, WarehouseType, ZoneType } from "@prisma/client";
import {
  nextDocumentNumber,
  SEQUENCE_KEYS,
} from "../services/supplyChain/numbering.service.js";
import { getStorageUtilisation } from "../services/supplyChain/wms.service.js";
import { DomainError, NotFoundError } from "../services/supplyChain/errors.js";
import {
  deleteImageFromS3,
  extractS3KeyFromUrl,
  uploadImageToS3,
} from "../services/upload.service.js";
import {
  handleSupplyChainError,
  paginationMeta,
  parseBoolean,
  parseEnum,
  parseId,
  parseOptionalId,
  parsePagination,
  optionalString,
  requireString,
} from "../utils/supplyChainHttp.js";

export class WarehouseController {
  private files(req: Request): Express.Multer.File[] {
    return Array.isArray(req.files) ? req.files : [];
  }

  private async uploadImages(
    files: Express.Multer.File[],
    warehouseCode: string,
    startAt = 0
  ) {
    const uploaded: Array<{ url: string; sortOrder: number }> = [];

    try {
      for (const [index, file] of files.entries()) {
        const result = await uploadImageToS3(
          file.buffer,
          "warehouses",
          `${warehouseCode}-${startAt + index + 1}`,
          file.mimetype
        );
        uploaded.push({ url: result.secureUrl, sortOrder: startAt + index });
      }
      return uploaded;
    } catch (error) {
      await this.cleanupUploads(uploaded.map(image => image.url));
      throw error;
    }
  }

  private async cleanupUploads(urls: string[]) {
    await Promise.all(
      urls.map(async url => {
        const key = extractS3KeyFromUrl(url);
        if (!key) return;
        try {
          await deleteImageFromS3(key);
        } catch (error) {
          console.warn("Failed to clean up warehouse image:", error);
        }
      })
    );
  }

  /** GET /api/warehouses */
  async list(req: Request, res: Response) {
    const operation = "List warehouses";
    try {
      const pagination = parsePagination(req, 50);
      const search = optionalString(req.query.search);
      const isActive = parseBoolean(req.query.isActive);

      const where = {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { code: { contains: search, mode: "insensitive" as const } },
                { city: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [totalItems, warehouses] = await Promise.all([
        prisma.warehouse.count({ where }),
        prisma.warehouse.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: [{ isDefault: "desc" }, { code: "asc" }],
          include: {
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
            _count: {
              select: { zones: true, bins: true, stockBalances: true },
            },
          },
        }),
      ]);

      return res.json({
        data: warehouses,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/warehouses/:id */
  async getById(req: Request, res: Response) {
    const operation = "Get warehouse";
    try {
      const id = parseId(req.params.id, "Warehouse id");
      const warehouse = await prisma.warehouse.findUnique({
        where: { id },
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          zones: {
            orderBy: { code: "asc" },
            include: { _count: { select: { bins: true } } },
          },
          _count: {
            select: { bins: true, pallets: true, stockBalances: true },
          },
        },
      });
      if (!warehouse) throw new NotFoundError("Warehouse");
      return res.json({ data: warehouse });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/warehouses */
  async create(req: Request, res: Response) {
    const operation = "Create warehouse";
    let uploadedImages: Array<{ url: string; sortOrder: number }> = [];
    let imagesPersisted = false;
    try {
      const code = requireString(req.body.code, "code").toUpperCase();
      const name = requireString(req.body.name, "name");
      const isDefault = parseBoolean(req.body.isDefault) ?? false;
      uploadedImages = await this.uploadImages(this.files(req), code);

      const warehouse = await prisma.$transaction(async tx => {
        if (isDefault) {
          await tx.warehouse.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.warehouse.create({
          data: {
            code,
            name,
            type:
              parseEnum(WarehouseType, req.body.type, "type") ??
              WarehouseType.WAREHOUSE,
            addressLine1: optionalString(req.body.addressLine1),
            addressLine2: optionalString(req.body.addressLine2),
            city: optionalString(req.body.city),
            state: optionalString(req.body.state),
            postalCode: optionalString(req.body.postalCode),
            country: optionalString(req.body.country) ?? "India",
            contactName: optionalString(req.body.contactName),
            contactPhone: optionalString(req.body.contactPhone),
            contactEmail: optionalString(req.body.contactEmail),
            gstNumber: optionalString(req.body.gstNumber),
            isActive: parseBoolean(req.body.isActive) ?? true,
            isDefault,
            allowNegativeStock:
              parseBoolean(req.body.allowNegativeStock) ?? false,
            images: uploadedImages.length
              ? { create: uploadedImages }
              : undefined,
          },
          include: { images: { orderBy: { sortOrder: "asc" } } },
        });
      });
      imagesPersisted = true;

      return res.status(201).json({ data: warehouse });
    } catch (error) {
      if (!imagesPersisted) {
        await this.cleanupUploads(uploadedImages.map(image => image.url));
      }
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/warehouses/:id/images */
  async addImages(req: Request, res: Response) {
    const operation = "Add warehouse images";
    let uploadedImages: Array<{ url: string; sortOrder: number }> = [];
    let imagesPersisted = false;

    try {
      const warehouseId = parseId(req.params.id, "Warehouse id");
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
        include: { _count: { select: { images: true } } },
      });
      if (!warehouse) throw new NotFoundError("Warehouse");

      const files = this.files(req);
      if (files.length === 0) {
        throw new DomainError("Select at least one image to upload", {
          code: "IMAGE_REQUIRED",
        });
      }
      if (warehouse._count.images + files.length > 8) {
        throw new DomainError("A warehouse can have up to 8 images", {
          status: 400,
          code: "IMAGE_LIMIT_EXCEEDED",
        });
      }

      const lastImage = await prisma.warehouseImage.aggregate({
        where: { warehouseId },
        _max: { sortOrder: true },
      });
      const startAt = (lastImage._max.sortOrder ?? -1) + 1;
      uploadedImages = await this.uploadImages(files, warehouse.code, startAt);

      await prisma.warehouseImage.createMany({
        data: uploadedImages.map(image => ({ warehouseId, ...image })),
      });
      imagesPersisted = true;

      const images = await prisma.warehouseImage.findMany({
        where: { warehouseId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return res.status(201).json({ data: images });
    } catch (error) {
      if (!imagesPersisted) {
        await this.cleanupUploads(uploadedImages.map(image => image.url));
      }
      handleSupplyChainError(error, res, operation);
    }
  }

  /** DELETE /api/warehouses/images/:imageId */
  async deleteImage(req: Request, res: Response) {
    const operation = "Delete warehouse image";
    try {
      const imageId = parseId(req.params.imageId, "Warehouse image id");
      const image = await prisma.warehouseImage.findUnique({
        where: { id: imageId },
      });
      if (!image) throw new NotFoundError("Warehouse image");

      await prisma.warehouseImage.delete({ where: { id: imageId } });
      await this.cleanupUploads([image.url]);
      return res.status(204).send();
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** PUT /api/warehouses/:id */
  async update(req: Request, res: Response) {
    const operation = "Update warehouse";
    try {
      const id = parseId(req.params.id, "Warehouse id");
      const existing = await prisma.warehouse.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Warehouse");

      const isDefault = parseBoolean(req.body.isDefault);
      const isActive = parseBoolean(req.body.isActive);

      // A warehouse still holding stock must not be switched off silently.
      if (isActive === false) {
        const held = await prisma.stockBalance.count({
          where: { warehouseId: id, quantity: { gt: 0 } },
        });
        if (held > 0) {
          throw new DomainError(
            `${existing.code} still holds stock in ${held} location(s); move or write it off before deactivating`,
            { status: 409, code: "WAREHOUSE_HAS_STOCK" }
          );
        }
      }

      const warehouse = await prisma.$transaction(async tx => {
        if (isDefault === true) {
          await tx.warehouse.updateMany({
            where: { isDefault: true, id: { not: id } },
            data: { isDefault: false },
          });
        }
        return tx.warehouse.update({
          where: { id },
          data: {
            ...(req.body.name !== undefined
              ? { name: requireString(req.body.name, "name") }
              : {}),
            ...(req.body.type !== undefined
              ? { type: parseEnum(WarehouseType, req.body.type, "type") }
              : {}),
            ...(req.body.addressLine1 !== undefined
              ? { addressLine1: optionalString(req.body.addressLine1) }
              : {}),
            ...(req.body.addressLine2 !== undefined
              ? { addressLine2: optionalString(req.body.addressLine2) }
              : {}),
            ...(req.body.city !== undefined
              ? { city: optionalString(req.body.city) }
              : {}),
            ...(req.body.state !== undefined
              ? { state: optionalString(req.body.state) }
              : {}),
            ...(req.body.postalCode !== undefined
              ? { postalCode: optionalString(req.body.postalCode) }
              : {}),
            ...(req.body.country !== undefined
              ? { country: optionalString(req.body.country) }
              : {}),
            ...(req.body.contactName !== undefined
              ? { contactName: optionalString(req.body.contactName) }
              : {}),
            ...(req.body.contactPhone !== undefined
              ? { contactPhone: optionalString(req.body.contactPhone) }
              : {}),
            ...(req.body.contactEmail !== undefined
              ? { contactEmail: optionalString(req.body.contactEmail) }
              : {}),
            ...(req.body.gstNumber !== undefined
              ? { gstNumber: optionalString(req.body.gstNumber) }
              : {}),
            ...(isActive !== undefined ? { isActive } : {}),
            ...(isDefault !== undefined ? { isDefault } : {}),
            ...(parseBoolean(req.body.allowNegativeStock) !== undefined
              ? {
                  allowNegativeStock: parseBoolean(req.body.allowNegativeStock),
                }
              : {}),
          },
        });
      });

      return res.json({ data: warehouse });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/warehouses/:id/zones */
  async listZones(req: Request, res: Response) {
    const operation = "List warehouse zones";
    try {
      const warehouseId = parseId(req.params.id, "Warehouse id");
      const zones = await prisma.warehouseZone.findMany({
        where: { warehouseId },
        orderBy: { code: "asc" },
        include: { _count: { select: { bins: true } } },
      });
      return res.json({ data: zones });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/warehouses/:id/zones */
  async createZone(req: Request, res: Response) {
    const operation = "Create warehouse zone";
    try {
      const warehouseId = parseId(req.params.id, "Warehouse id");
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
      });
      if (!warehouse) throw new NotFoundError("Warehouse");

      const zone = await prisma.warehouseZone.create({
        data: {
          warehouseId,
          code: requireString(req.body.code, "code").toUpperCase(),
          name: requireString(req.body.name, "name"),
          zoneType:
            parseEnum(ZoneType, req.body.zoneType, "zoneType") ??
            ZoneType.STORAGE,
          temperatureControlled:
            parseBoolean(req.body.temperatureControlled) ?? false,
          isActive: parseBoolean(req.body.isActive) ?? true,
        },
      });

      return res.status(201).json({ data: zone });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/warehouses/:id/bins */
  async listBins(req: Request, res: Response) {
    const operation = "List storage bins";
    try {
      const warehouseId = parseId(req.params.id, "Warehouse id");
      const pagination = parsePagination(req, 100, 500);
      const zoneId = parseOptionalId(req.query.zoneId);
      const search = optionalString(req.query.search);
      const onlyEmpty = parseBoolean(req.query.onlyEmpty);

      const where = {
        warehouseId,
        ...(zoneId ? { zoneId } : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" as const } },
                { aisle: { contains: search, mode: "insensitive" as const } },
                { rack: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(onlyEmpty
          ? { stockBalances: { none: { quantity: { gt: 0 } } } }
          : {}),
      };

      const [totalItems, bins] = await Promise.all([
        prisma.storageBin.count({ where }),
        prisma.storageBin.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: [{ pickSequence: "asc" }, { code: "asc" }],
          include: {
            zone: {
              select: { id: true, code: true, name: true, zoneType: true },
            },
            _count: { select: { stockBalances: true } },
          },
        }),
      ]);

      return res.json({
        data: bins,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/warehouses/:id/bins */
  async createBin(req: Request, res: Response) {
    const operation = "Create storage bin";
    try {
      const warehouseId = parseId(req.params.id, "Warehouse id");
      const zoneId = parseId(String(req.body.zoneId), "zoneId");

      const zone = await prisma.warehouseZone.findUnique({
        where: { id: zoneId },
      });
      if (!zone) throw new NotFoundError("Warehouse zone");
      if (zone.warehouseId !== warehouseId) {
        throw new DomainError("That zone belongs to a different warehouse", {
          code: "ZONE_WAREHOUSE_MISMATCH",
        });
      }

      const bin = await prisma.storageBin.create({
        data: {
          warehouseId,
          zoneId,
          code: requireString(req.body.code, "code").toUpperCase(),
          aisle: optionalString(req.body.aisle),
          rack: optionalString(req.body.rack),
          level: optionalString(req.body.level),
          position: optionalString(req.body.position),
          binType:
            parseEnum(BinType, req.body.binType, "binType") ?? BinType.SHELF,
          pickSequence: Number(req.body.pickSequence) || 0,
          maxWeightKg: req.body.maxWeightKg
            ? String(req.body.maxWeightKg)
            : null,
          maxVolumeM3: req.body.maxVolumeM3
            ? String(req.body.maxVolumeM3)
            : null,
          isPickFace: parseBoolean(req.body.isPickFace) ?? false,
          isReceiving:
            parseBoolean(req.body.isReceiving) ??
            zone.zoneType === ZoneType.RECEIVING,
          isShipping:
            parseBoolean(req.body.isShipping) ??
            zone.zoneType === ZoneType.SHIPPING,
          isQuarantine:
            parseBoolean(req.body.isQuarantine) ??
            zone.zoneType === ZoneType.QUARANTINE,
          isBlocked: parseBoolean(req.body.isBlocked) ?? false,
          isActive: parseBoolean(req.body.isActive) ?? true,
        },
        include: { zone: { select: { id: true, code: true, name: true } } },
      });

      return res.status(201).json({ data: bin });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * POST /api/warehouses/:id/bins/bulk
   * Generate a rack layout in one shot. Enterprises do not enter 400 bin codes
   * by hand, and a consistent aisle/rack/level code is what makes pick paths
   * sortable.
   */
  async generateBins(req: Request, res: Response) {
    const operation = "Generate storage bins";
    try {
      const warehouseId = parseId(req.params.id, "Warehouse id");
      const zoneId = parseId(String(req.body.zoneId), "zoneId");

      const zone = await prisma.warehouseZone.findUnique({
        where: { id: zoneId },
      });
      if (!zone) throw new NotFoundError("Warehouse zone");
      if (zone.warehouseId !== warehouseId) {
        throw new DomainError("That zone belongs to a different warehouse", {
          code: "ZONE_WAREHOUSE_MISMATCH",
        });
      }

      const aisles = Number(req.body.aisles);
      const racksPerAisle = Number(req.body.racksPerAisle);
      const levelsPerRack = Number(req.body.levelsPerRack);
      const positionsPerLevel = Number(req.body.positionsPerLevel) || 1;

      if (
        ![aisles, racksPerAisle, levelsPerRack, positionsPerLevel].every(
          value => Number.isInteger(value) && value > 0
        )
      ) {
        throw new DomainError(
          "aisles, racksPerAisle, levelsPerRack and positionsPerLevel must be positive integers",
          {
            code: "VALIDATION_ERROR",
          }
        );
      }

      const total = aisles * racksPerAisle * levelsPerRack * positionsPerLevel;
      if (total > 5000) {
        throw new DomainError(
          `That layout would create ${total} bins; generate at most 5000 at a time`,
          {
            code: "TOO_MANY_BINS",
          }
        );
      }

      const binType =
        parseEnum(BinType, req.body.binType, "binType") ?? BinType.PALLET_RACK;
      const prefix = optionalString(req.body.prefix) ?? zone.code;
      const pickFaceLevel = optionalString(req.body.pickFaceLevel);

      const rows: Array<{
        warehouseId: number;
        zoneId: number;
        code: string;
        aisle: string;
        rack: string;
        level: string;
        position: string;
        binType: BinType;
        pickSequence: number;
        isPickFace: boolean;
      }> = [];

      let sequence = 0;
      for (let aisle = 1; aisle <= aisles; aisle += 1) {
        const aisleCode = `A${String(aisle).padStart(2, "0")}`;
        for (let rack = 1; rack <= racksPerAisle; rack += 1) {
          const rackCode = `R${String(rack).padStart(2, "0")}`;
          for (let level = 1; level <= levelsPerRack; level += 1) {
            const levelCode = `L${String(level).padStart(2, "0")}`;
            for (
              let position = 1;
              position <= positionsPerLevel;
              position += 1
            ) {
              const positionCode = `P${String(position).padStart(2, "0")}`;
              sequence += 1;
              rows.push({
                warehouseId,
                zoneId,
                code: `${prefix}-${aisleCode}-${rackCode}-${levelCode}-${positionCode}`,
                aisle: aisleCode,
                rack: rackCode,
                level: levelCode,
                position: positionCode,
                binType,
                // Serpentine order: even aisles run backwards so a picker
                // walks up one aisle and down the next.
                pickSequence:
                  aisle % 2 === 0
                    ? aisle * 100000 +
                      (racksPerAisle - rack) * 1000 +
                      level * 10 +
                      position
                    : sequence,
                isPickFace: pickFaceLevel
                  ? levelCode === pickFaceLevel.toUpperCase()
                  : level === 1,
              });
            }
          }
        }
      }

      const created = await prisma.storageBin.createMany({
        data: rows,
        skipDuplicates: true,
      });

      return res.status(201).json({
        data: {
          requested: rows.length,
          created: created.count,
          skippedExisting: rows.length - created.count,
        },
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** PUT /api/warehouses/bins/:binId */
  async updateBin(req: Request, res: Response) {
    const operation = "Update storage bin";
    try {
      const binId = parseId(req.params.binId, "Bin id");
      const existing = await prisma.storageBin.findUnique({
        where: { id: binId },
      });
      if (!existing) throw new NotFoundError("Storage bin");

      const bin = await prisma.storageBin.update({
        where: { id: binId },
        data: {
          ...(req.body.code !== undefined
            ? { code: requireString(req.body.code, "code").toUpperCase() }
            : {}),
          ...(req.body.aisle !== undefined
            ? { aisle: optionalString(req.body.aisle) }
            : {}),
          ...(req.body.rack !== undefined
            ? { rack: optionalString(req.body.rack) }
            : {}),
          ...(req.body.level !== undefined
            ? { level: optionalString(req.body.level) }
            : {}),
          ...(req.body.position !== undefined
            ? { position: optionalString(req.body.position) }
            : {}),
          ...(req.body.binType !== undefined
            ? { binType: parseEnum(BinType, req.body.binType, "binType") }
            : {}),
          ...(req.body.pickSequence !== undefined
            ? { pickSequence: Number(req.body.pickSequence) || 0 }
            : {}),
          ...(req.body.maxWeightKg !== undefined
            ? {
                maxWeightKg: req.body.maxWeightKg
                  ? String(req.body.maxWeightKg)
                  : null,
              }
            : {}),
          ...(req.body.maxVolumeM3 !== undefined
            ? {
                maxVolumeM3: req.body.maxVolumeM3
                  ? String(req.body.maxVolumeM3)
                  : null,
              }
            : {}),
          ...(parseBoolean(req.body.isPickFace) !== undefined
            ? { isPickFace: parseBoolean(req.body.isPickFace) }
            : {}),
          ...(parseBoolean(req.body.isReceiving) !== undefined
            ? { isReceiving: parseBoolean(req.body.isReceiving) }
            : {}),
          ...(parseBoolean(req.body.isShipping) !== undefined
            ? { isShipping: parseBoolean(req.body.isShipping) }
            : {}),
          ...(parseBoolean(req.body.isQuarantine) !== undefined
            ? { isQuarantine: parseBoolean(req.body.isQuarantine) }
            : {}),
          ...(parseBoolean(req.body.isBlocked) !== undefined
            ? { isBlocked: parseBoolean(req.body.isBlocked) }
            : {}),
          ...(parseBoolean(req.body.isActive) !== undefined
            ? { isActive: parseBoolean(req.body.isActive) }
            : {}),
        },
        include: { zone: { select: { id: true, code: true, name: true } } },
      });

      return res.json({ data: bin });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/warehouses/:id/utilisation */
  async utilisation(req: Request, res: Response) {
    const operation = "Get storage utilisation";
    try {
      const warehouseId = parseId(req.params.id, "Warehouse id");
      const data = await getStorageUtilisation(warehouseId);
      return res.json({ data });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** GET /api/warehouses/:id/pallets */
  async listPallets(req: Request, res: Response) {
    const operation = "List pallets";
    try {
      const warehouseId = parseId(req.params.id, "Warehouse id");
      const pagination = parsePagination(req, 50);
      const status = parseEnum(PalletStatus, req.query.status, "status");

      const where = { warehouseId, ...(status ? { status } : {}) };

      const [totalItems, pallets] = await Promise.all([
        prisma.pallet.count({ where }),
        prisma.pallet.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { code: "asc" },
          include: {
            bin: { select: { id: true, code: true } },
            stockBalances: {
              select: {
                quantity: true,
                product: { select: { id: true, code: true, name: true } },
                lot: { select: { lotNumber: true } },
              },
            },
          },
        }),
      ]);

      return res.json({
        data: pallets,
        pagination: paginationMeta(totalItems, pagination),
      });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /** POST /api/warehouses/:id/pallets */
  async createPallet(req: Request, res: Response) {
    const operation = "Create pallet";
    try {
      const warehouseId = parseId(req.params.id, "Warehouse id");
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
      });
      if (!warehouse) throw new NotFoundError("Warehouse");

      const binId = parseOptionalId(req.body.binId);
      if (binId) {
        const bin = await prisma.storageBin.findUnique({
          where: { id: binId },
        });
        if (!bin || bin.warehouseId !== warehouseId) {
          throw new DomainError("That bin does not belong to this warehouse", {
            code: "BIN_WAREHOUSE_MISMATCH",
          });
        }
      }

      const pallet = await prisma.$transaction(async tx => {
        const code =
          optionalString(req.body.code) ??
          (await nextDocumentNumber(tx, SEQUENCE_KEYS.PALLET));
        return tx.pallet.create({
          data: {
            code,
            warehouseId,
            binId,
            status:
              parseEnum(PalletStatus, req.body.status, "status") ??
              PalletStatus.EMPTY,
            notes: optionalString(req.body.notes),
          },
        });
      });

      return res.status(201).json({ data: pallet });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }

  /**
   * PATCH /api/warehouses/pallets/:palletId/move
   * Move a pallet, and everything standing on it, to another bin.
   */
  async movePallet(req: Request, res: Response) {
    const operation = "Move pallet";
    try {
      const palletId = parseId(req.params.palletId, "Pallet id");
      const toBinId = parseId(String(req.body.toBinId), "toBinId");

      const result = await prisma.$transaction(async tx => {
        const pallet = await tx.pallet.findUnique({
          where: { id: palletId },
          include: { stockBalances: true },
        });
        if (!pallet) throw new NotFoundError("Pallet");

        const bin = await tx.storageBin.findUnique({ where: { id: toBinId } });
        if (!bin) throw new NotFoundError("Destination bin");
        if (bin.warehouseId !== pallet.warehouseId) {
          throw new DomainError(
            "A pallet cannot be moved to a bin in another warehouse",
            {
              code: "BIN_WAREHOUSE_MISMATCH",
            }
          );
        }
        if (bin.isBlocked || !bin.isActive) {
          throw new DomainError(`Bin ${bin.code} is blocked or inactive`, {
            code: "BIN_BLOCKED",
          });
        }

        // The stock on the pallet travels with it; quantities are unchanged so
        // the balance rows only need their location updating.
        await tx.stockBalance.updateMany({
          where: { palletId },
          data: { binId: toBinId, lastMovementAt: new Date() },
        });

        return tx.pallet.update({
          where: { id: palletId },
          data: {
            binId: toBinId,
            status:
              pallet.stockBalances.length > 0
                ? PalletStatus.IN_USE
                : pallet.status,
          },
          include: { bin: { select: { id: true, code: true } } },
        });
      });

      return res.json({ data: result });
    } catch (error) {
      handleSupplyChainError(error, res, operation);
    }
  }
}
