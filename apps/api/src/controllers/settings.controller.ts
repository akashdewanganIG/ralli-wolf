import { Request, Response } from "express";
import {
  getGlobalSettings as getGlobalSettingsFromDb,
  updateGlobalSetting as updateGlobalSettingInDb,
  getCurrencies as getCurrenciesFromDb,
} from "../services/settings.service.js";
import { handleError } from "../utils/error-handler.js";

export const getGlobalSettings = async (req: Request, res: Response) => {
  try {
    const settings = await getGlobalSettingsFromDb();
    res.json(settings);
  } catch (error) {
    handleError(error, res, "Get global settings");
  }
};

export const updateGlobalSetting = async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    if (
      typeof key !== "string" ||
      !key.trim() ||
      typeof value !== "string" ||
      !value.trim()
    ) {
      return res
        .status(400)
        .json({ message: "Setting key and value are required" });
    }
    const setting = await updateGlobalSettingInDb(key, value);
    res.json(setting);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error updating global setting";
    const status = message.startsWith("Unsupported currency:") ? 400 : 500;
    res.status(status).json({ message });
  }
};

export const getCurrencies = async (req: Request, res: Response) => {
  try {
    const currencies = await getCurrenciesFromDb();
    res.json(currencies);
  } catch (error) {
    handleError(error, res, "Get currencies");
  }
};
