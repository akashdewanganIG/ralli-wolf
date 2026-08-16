import { BrevoCampaign } from "@/lib/api/types";
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

  // Helper function to add a stat row
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

  // Calculate statistics
  const globalStats = campaign.statistics?.globalStats;
  const legacyStats = campaign.statistics;
  const safeRate = (num: number, den: number) =>
    den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0;

  const sent = globalStats?.sent || (legacyStats as any)?.sent || 0;
  const delivered =
    globalStats?.delivered || (legacyStats as any)?.delivered || 0;
  const opens =
    globalStats?.uniqueViews ||
    (legacyStats as any)?.uniqueOpens ||
    (legacyStats as any)?.opens ||
    0;
  const clicks =
    globalStats?.uniqueClicks ||
    (legacyStats as any)?.uniqueClicks ||
    (legacyStats as any)?.clicks ||
    0;
  const unsubscribes =
    globalStats?.unsubscriptions || (legacyStats as any)?.unsubscriptions || 0;
  const spamReports =
    globalStats?.complaints || (legacyStats as any)?.spamReports || 0;
  const hardBounces =
    globalStats?.hardBounces || (legacyStats as any)?.hardBounces || 0;
  const softBounces =
    globalStats?.softBounces || (legacyStats as any)?.softBounces || 0;
  const totalOpens =
    globalStats?.viewed ||
    (legacyStats as any)?.opens ||
    (legacyStats as any)?.uniqueOpens ||
    0;
  const totalClicks =
    globalStats?.clickers ||
    (legacyStats as any)?.clicks ||
    (legacyStats as any)?.uniqueClicks ||
    0;
  const appleMPPOpens = globalStats?.appleMppOpens || 0;

  const deliveryRate = safeRate(delivered, sent);
  const openRate =
    globalStats?.opensRate ??
    (legacyStats as any)?.openPercentage ??
    safeRate(opens, delivered || sent);
  const clickThroughRate =
    (legacyStats as any)?.clickPercentage ??
    safeRate(clicks, delivered || sent);
  const clickToOpenRate = safeRate(clicks, opens);
  const unsubscribeRate =
    (legacyStats as any)?.unsubscriptionPercentage ??
    safeRate(unsubscribes, delivered || sent);
  // Format dates
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

  // Helper function to add stat row in a column
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

  // Helper function to add section header in a column
  const addSectionHeaderInColumn = (text: string, y: number, x: number) => {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(text, x, y);
    return y + 8;
  };

  // Top section: Logo on left
  const topY = margin;

  // logo at top left
  if (logoDataUrl) {
    try {
      const logoWidth = 40;
      const logoHeight = 8;
      doc.addImage(logoDataUrl, "PNG", margin, topY, logoWidth, logoHeight);
    } catch (e) {
      console.warn("Could not add logo to PDF:", e);
    }
  }

  // Campaign Information below logo (with space after logo)
  yPos = topY + 8 + 10; // Logo height (8) + space (10) = 18

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(campaignName, margin, yPos);

  // Add notes on right side, same level as campaign name, left-aligned
  const notesX = pageWidth - margin - 70; // Right side of page, with space for text
  const notesStartY = yPos; // Same Y level as campaign name
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  // All notes items aligned vertically (same X position), left-aligned
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

  // Email Details
  yPos = addStatRow("Subject", subject || "-", yPos);
  yPos = addStatRow("From", fromEmail || "-", yPos);
  yPos = addStatRow("Reply To", replyToEmail || "-", yPos);
  yPos += 10;

  // Two-column layout for sections
  const columnWidth = (pageWidth - 2 * margin) / 2;
  const leftColumnX = margin;
  const rightColumnX = margin + columnWidth + 10; // 10px gap between columns
  const sectionsStartY = yPos;

  // Left column: Deliverability
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
    `${softBounces} (${softBounces > 0 ? safeRate(softBounces, sent).toFixed(2) : 0}%)`,
    leftY,
    leftColumnX
  );
  leftY = addStatRowInColumn(
    "Hard bounces",
    `${hardBounces} (${hardBounces > 0 ? safeRate(hardBounces, sent).toFixed(2) : 0}%)`,
    leftY,
    leftColumnX
  );
  leftY += 5;

  // Left column: Opens (below Deliverability)
  const opensStartY = leftY; // Store the Y position where Opens starts
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

  // Right column: Clicks (same level as Deliverability)
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

  // Right column: Unsubscribes (same level as Opens, not below Clicks)
  addSectionHeaderInColumn("Unsubscribes", opensStartY, rightColumnX);
  rightY = opensStartY + 8; // Same spacing as Opens header
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

  // Check if we need a new page (use the maximum Y position from both columns)
  const maxY = Math.max(leftY, rightY);
  if (maxY > pageHeight - 30) {
    doc.addPage();
  }

  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on ${exportedDate}`, pageWidth / 2, footerY, {
    align: "center",
  });

  // Save the PDF
  const fileName = `${campaignName.replace(/[^a-z0-9]/gi, "_")}_Report.pdf`;
  doc.save(fileName);
}
