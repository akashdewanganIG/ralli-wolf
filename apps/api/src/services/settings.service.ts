import { prisma } from "@repo/db";

export const getGlobalSettings = async () => {
  const settings = await prisma.globalSetting.findMany();
  const values = settings.reduce(
    (acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    },
    {} as Record<string, string>
  );

  // `defaultCurrency` is the canonical key. Keep existing installations that
  // still have the former `currency` key readable until their next save.
  if (!values.defaultCurrency && values.currency) {
    values.defaultCurrency = values.currency;
  }

  return values;
};

export const updateGlobalSetting = async (key: string, value: string) => {
  const canonicalKey = key === "currency" ? "defaultCurrency" : key;

  if (canonicalKey === "defaultCurrency") {
    const currency = await prisma.currency.findUnique({
      where: { code: value },
    });
    if (!currency) {
      throw new Error(`Unsupported currency: ${value}`);
    }

    return prisma.globalSetting.upsert({
      where: { key: canonicalKey },
      update: { value },
      create: { key: canonicalKey, value },
    });
  }

  return await prisma.globalSetting.upsert({
    where: { key: canonicalKey },
    update: { value },
    create: { key: canonicalKey, value },
  });
};

export const getCurrencies = async () => {
  return await prisma.currency.findMany({ orderBy: { code: "asc" } });
};
