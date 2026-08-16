import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { prisma } from "@repo/db";
import { generateToken } from "../src/utils/jwt.utils.js";

const apiUrl = process.env.API_URL || "http://localhost:4000";
const stamp = Date.now();
const companyName = `CRM Verification ${stamp}`;
const emails = {
  valid: `valid.${stamp}@workflow-test.example`,
  invalid: `invalid.${stamp}@workflow-test.example`,
  converted: `converted.${stamp}@workflow-test.example`,
};

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      email: { not: process.env.DEVELOPER_LOGIN_EMAIL },
      role: "ADMIN",
    },
    orderBy: { id: "asc" },
  });
  assert(user, "An active admin user is required for workflow verification");
  const headers = {
    Authorization: `Bearer ${generateToken(user.id, user.email)}`,
  };
  const get = async (path: string) => {
    const response = await fetch(`${apiUrl}${path}`, { headers });
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
    return response;
  };

  const health = await (await fetch(`${apiUrl}/health`)).json();
  assert.deepEqual(health, { status: "ok", database: "connected" });
  assert.equal(
    (await fetch(`${apiUrl}/api/leads`)).status,
    401,
    "Protected lead routes must reject anonymous requests"
  );

  const templateResponse = await get("/api/leads/import/template");
  const template = new ExcelJS.Workbook();
  await template.xlsx.load(
    Buffer.from(await templateResponse.arrayBuffer()) as unknown as Parameters<
      typeof template.xlsx.load
    >[0]
  );
  const importSheet = template.getWorksheet("Lead Import");
  const exampleSheet = template.getWorksheet("Example");
  assert(
    importSheet && exampleSheet,
    "Template must contain import and example sheets"
  );
  assert.equal(importSheet.getCell("A1").value, "First Name");
  assert.equal(
    importSheet.getCell("A2").value,
    null,
    "Import sheet must not contain demo data"
  );
  assert.equal(importSheet.getCell("I2").dataValidation.type, "list");
  assert.equal(exampleSheet.getCell("A2").value, "Aarav");

  const csv = [
    "Full Name,Work Email,Mobile Number,Organisation,Town,Province,Postal Code,Stage",
    `Audit Valid,${emails.valid},8910000001,${companyName},Pune,Maharashtra,411001,OPEN`,
    `Audit Duplicate,${emails.valid},8910000002,${companyName},Pune,Maharashtra,411001,WORKING`,
    `Audit Invalid,${emails.invalid},8910000003,${companyName},Pune,Maharashtra,411001,BROKEN`,
    ",,,,,,,",
    `Audit Converted,${emails.converted},8910000004,${companyName},Pune,Maharashtra,411001,CONVERTED`,
  ].join("\n");
  const importFile = new FormData();
  importFile.append(
    "file",
    new Blob([csv], { type: "text/csv" }),
    "workflow.csv"
  );
  const importResponse = await fetch(`${apiUrl}/api/leads/import`, {
    method: "POST",
    headers,
    body: importFile,
  });
  assert.equal(importResponse.status, 200);
  const imported = await importResponse.json();
  assert.deepEqual(
    {
      insertedCount: imported.insertedCount,
      skippedDuplicates: imported.skippedDuplicates,
      skippedCount: imported.skippedCount,
      errorCount: imported.errors.length,
    },
    { insertedCount: 2, skippedDuplicates: 1, skippedCount: 1, errorCount: 1 }
  );
  assert(imported.report?.base64, "Skipped-row report must be returned");

  const convertedLead = await prisma.lead.findFirst({
    where: { email: emails.converted },
    include: { convertedToContact: { include: { account: true } } },
  });
  assert.equal(convertedLead?.status, "CONVERTED");
  assert.equal(convertedLead.convertedToContact?.email, emails.converted);
  assert.equal(convertedLead.convertedToContact?.account?.name, companyName);

  const duplicateFile = new FormData();
  duplicateFile.append(
    "file",
    new Blob([csv], { type: "text/csv" }),
    "workflow.csv"
  );
  const duplicateResponse = await fetch(`${apiUrl}/api/leads/import`, {
    method: "POST",
    headers,
    body: duplicateFile,
  });
  const duplicateResult = await duplicateResponse.json();
  assert.deepEqual(
    {
      insertedCount: duplicateResult.insertedCount,
      skippedDuplicates: duplicateResult.skippedDuplicates,
      skippedCount: duplicateResult.skippedCount,
    },
    { insertedCount: 0, skippedDuplicates: 3, skippedCount: 1 }
  );

  const oversizedCsv = [
    "First Name,Email",
    ...Array.from(
      { length: 1001 },
      (_, index) =>
        `Lead ${index},oversized.${stamp}.${index}@workflow-test.example`
    ),
  ].join("\n");
  const oversizedFile = new FormData();
  oversizedFile.append(
    "file",
    new Blob([oversizedCsv], { type: "text/csv" }),
    "oversized.csv"
  );
  const oversizedResponse = await fetch(`${apiUrl}/api/leads/import`, {
    method: "POST",
    headers,
    body: oversizedFile,
  });
  assert.equal(oversizedResponse.status, 400);

  const workbookResponse = await get(
    "/api/export/leads?startPage=1&endPage=1&limit=20&format=xlsx"
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(await workbookResponse.arrayBuffer()) as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0]
  );
  const exportSheet = workbook.worksheets[0];
  assert(exportSheet, "Lead export sheet is required");
  const xlsxHeaders = exportSheet.getRow(1).values as Array<string | undefined>;
  assert.equal(exportSheet.views[0]?.state, "frozen");
  assert(exportSheet.autoFilter, "Lead export must have an auto-filter");
  assert.equal(exportSheet.getColumn(6).numFmt, "@");
  assert.equal(exportSheet.getColumn(10).numFmt, "@");

  const csvResponse = await get(
    "/api/export/leads?startPage=1&endPage=1&limit=20&format=csv"
  );
  const csvRows = parse(await csvResponse.text(), { bom: true }) as string[][];
  assert.deepEqual(csvRows[0], xlsxHeaders.slice(1));

  const weekly = await (
    await get("/api/dashboard/leads-generated?period=week")
  ).json();
  assert.equal(
    weekly.labels.length,
    7,
    "Weekly chart must contain exactly seven days"
  );

  console.log(
    JSON.stringify(
      {
        health,
        import: {
          inserted: imported.insertedCount,
          duplicates: imported.skippedDuplicates,
          invalid: imported.skippedCount,
          transactionLinked: true,
          repeatIsIdempotent: true,
          oversizedRejected: true,
        },
        export: {
          matchingColumns: csvRows[0].length,
          frozenHeader: true,
          autoFilter: true,
          textSafeColumns: true,
        },
        dashboard: { weeklyPoints: weekly.labels.length },
      },
      null,
      2
    )
  );
}

main()
  .finally(async () => {
    await prisma.lead.deleteMany({
      where: { email: { in: Object.values(emails) } },
    });
    await prisma.contact.deleteMany({
      where: { email: { in: Object.values(emails) } },
    });
    await prisma.account.deleteMany({ where: { name: companyName } });
    await prisma.$disconnect();
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
