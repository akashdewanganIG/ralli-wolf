import { BrevoCampaign } from "@/lib/api/types";
import { normalizeBrevoCampaignStats } from "@/lib/brevo";
import jsPDF from "jspdf";

export async function generateCampaignPDF(
  campaign: BrevoCampaign,
  campaignName: string,
  subject?: string,
  fromEmail?: string,
  replyToEmail?: string,
  logoDataUrl?: string
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  const addStatRow = (
    label: string,
    value: string | number,
    y: number,
    indent: number = 0
  ) => {
    const x = margin + indent;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`${label}:`, x, y);

    doc.setFont("helvetica", "bold");
    const valueText = typeof value === "number" ? value.toString() : value;
    const labelWidth = doc.getTextWidth(`${label}: `);
    doc.text(valueText, x + labelWidth, y);

    return y + 6;
  };

  const stats = normalizeBrevoCampaignStats(campaign);
  const sent = stats.sent;
  const delivered = stats.delivered;
  const opens = stats.uniqueOpens;
  const clicks = stats.uniqueClicks;
  const spamReports = stats.complaints;
  const hardBounces = stats.hardBounces;
  const softBounces = stats.softBounces;
  const totalOpens = stats.totalOpens;
  const totalClicks = stats.totalClicks;
  const appleMPPOpens = stats.appleMppOpens;
  const deliveryRate = stats.deliveryRate;
  const openRate = stats.openRate;
  const clickThroughRate = stats.clickRate;
  const clickToOpenRate = stats.clickToOpenRate;
  const unsubscribeRate = stats.unsubscribeRate;
  const percentage = (numerator: number, denominator: number) =>
    denominator > 0 ? (numerator / denominator) * 100 : 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const time = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const dateFormatted = date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return `${time}, ${dateFormatted}`;
  };

  const sentDate = formatDate(campaign.scheduledAt || campaign.createdAt);
  const exportedDate = formatDate(new Date().toISOString());

  const addStatRowInColumn = (
    label: string,
    value: string | number,
    y: number,
    x: number
  ) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`${label}:`, x, y);

    doc.setFont("helvetica", "bold");
    const valueText = typeof value === "number" ? value.toString() : value;
    const labelWidth = doc.getTextWidth(`${label}: `);
    doc.text(valueText, x + labelWidth, y);

    return y + 6;
  };

  const addSectionHeaderInColumn = (text: string, y: number, x: number) => {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(text, x, y);
    return y + 8;
  };

  const topY = margin;

  if (logoDataUrl) {
    try {
      const logoWidth = 40;
      const logoHeight = 8;
      doc.addImage(logoDataUrl, "PNG", margin, topY, logoWidth, logoHeight);
    } catch {
      logoDataUrl = undefined;
    }
  }

  yPos = topY + 8 + 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(campaignName, margin, yPos);

  const notesX = pageWidth - margin - 70;
  const notesStartY = yPos;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  doc.text("Notes:", notesX, notesStartY, { align: "left" });
  doc.text("• Apple MPP opens included.", notesX, notesStartY + 5, {
    align: "left",
  });
  doc.text("• Bot opens and clicks included.", notesX, notesStartY + 10, {
    align: "left",
  });

  yPos += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  yPos = addStatRow("Campaign ID", `#${campaign.id}`, yPos);
  yPos = addStatRow("Sent Date/Time", sentDate, yPos);
  yPos = addStatRow("Exported Date/Time", exportedDate, yPos);
  yPos += 2;

  yPos = addStatRow("Subject", subject || "-", yPos);
  yPos = addStatRow("From", fromEmail || "-", yPos);
  yPos = addStatRow("Reply To", replyToEmail || "-", yPos);
  yPos += 10;

  const columnWidth = (pageWidth - 2 * margin) / 2;
  const leftColumnX = margin;
  const rightColumnX = margin + columnWidth + 10;
  const sectionsStartY = yPos;

  let leftY = sectionsStartY;
  leftY = addSectionHeaderInColumn("Deliverability", leftY, leftColumnX);
  leftY += 2;
  leftY = addStatRowInColumn("Sent to", sent, leftY, leftColumnX);
  leftY = addStatRowInColumn("Delivered", delivered, leftY, leftColumnX);
  leftY = addStatRowInColumn(
    "Delivery rate",
    `${deliveryRate.toFixed(2)}%`,
    leftY,
    leftColumnX
  );
  leftY = addStatRowInColumn(
    "Soft bounces",
    `${softBounces} (${percentage(softBounces, sent).toFixed(2)}%)`,
    leftY,
    leftColumnX
  );
  leftY = addStatRowInColumn(
    "Hard bounces",
    `${hardBounces} (${percentage(hardBounces, sent).toFixed(2)}%)`,
    leftY,
    leftColumnX
  );
  leftY += 5;

  const opensStartY = leftY;
  leftY = addSectionHeaderInColumn("Opens", leftY, leftColumnX);
  leftY += 2;
  leftY = addStatRowInColumn("Opens", opens, leftY, leftColumnX);
  leftY = addStatRowInColumn(
    "Open rate",
    `${openRate.toFixed(2)}%`,
    leftY,
    leftColumnX
  );
  leftY = addStatRowInColumn("Total opens", totalOpens, leftY, leftColumnX);
  leftY = addStatRowInColumn(
    "Apple MPP opens",
    appleMPPOpens,
    leftY,
    leftColumnX
  );

  let rightY = sectionsStartY;
  rightY = addSectionHeaderInColumn("Clicks", rightY, rightColumnX);
  rightY += 2;
  rightY = addStatRowInColumn("Clicks", clicks, rightY, rightColumnX);
  rightY = addStatRowInColumn(
    "Click-through rate",
    `${clickThroughRate.toFixed(2)}%`,
    rightY,
    rightColumnX
  );
  rightY = addStatRowInColumn(
    "Total clicks",
    totalClicks,
    rightY,
    rightColumnX
  );
  rightY = addStatRowInColumn(
    "Click-to-open rate",
    `${clickToOpenRate.toFixed(2)}%`,
    rightY,
    rightColumnX
  );

  addSectionHeaderInColumn("Unsubscribes", opensStartY, rightColumnX);
  rightY = opensStartY + 8;
  rightY += 2;
  rightY = addStatRowInColumn(
    "Unsubscribe rate",
    `${unsubscribeRate.toFixed(2)}%`,
    rightY,
    rightColumnX
  );
  rightY = addStatRowInColumn(
    "Spam complaints",
    spamReports,
    rightY,
    rightColumnX
  );

  const maxY = Math.max(leftY, rightY);
  if (maxY > pageHeight - 30) {
    doc.addPage();
  }

  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on ${exportedDate}`, pageWidth / 2, footerY, {
    align: "center",
  });

  const fileName = `${campaignName.replace(/[^a-z0-9]/gi, "_")}_Report.pdf`;
  doc.save(fileName);
}
