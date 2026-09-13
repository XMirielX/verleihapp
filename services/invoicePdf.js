const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

async function createInvoicePdf(invoice, items) {
  const templatePath = path.join(__dirname, "..", "views", "invoice-pdf.html");

  const cssPath = path.join(
    __dirname,
    "..",
    "public",
    "css",
    "invoice-print.css",
  );

  let html = fs.readFileSync(templatePath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
// ---------------------------------------------------
// Headerbild
// ---------------------------------------------------

let headerImage = "";

const imagePath = path.join(
  __dirname,
  "..",
  "public",
  "img",
  "PdfHeader.png",
);

if (fs.existsSync(imagePath)) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString("base64");

  headerImage = `data:image/png;base64,${base64}`;
}
  // ---------------------------------------------------
  // Rechnungspositionen
  // ---------------------------------------------------
// ---------------------------------------------------
// Rechnungspositionen
// ---------------------------------------------------

const MIN_ROWS = 10;

let itemRows = items
  .map((item, index) => {
    return `
      <tr>
        <td class="position">
          ${index + 1}
        </td>

        <td class="quantity">
          ${escapeHtml(item.quantity)}
        </td>

        <td class="description">
          ${escapeHtml(item.description)}
        </td>

        <td class="price">
          ${formatCurrency(item.unit_price)}
        </td>

        <td class="price">
          ${formatCurrency(item.total)}
        </td>
      </tr>
    `;
  })
  .join("");

// ---------------------------------------------------
// Leere Zeilen bis zur Mindestanzahl ergänzen
// ---------------------------------------------------

const emptyRows = Math.max(0, MIN_ROWS - items.length);

for (let i = 0; i < emptyRows; i++) {
  itemRows += `
    <tr class="empty-row">
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  `;
}
  // ---------------------------------------------------
  // Platzhalter ersetzen
  // ---------------------------------------------------

  html = html
    .replace("{{CSS}}", css)

    .replace(
      "{{HEADER_IMAGE}}",
      headerImage
        ? `<img src="${headerImage}" alt="Förderverein THW-Steinau e.V.">`
        : "",
    )

    .replaceAll("{{INVOICE_DATE}}", formatDate(invoice.invoice_date))

    .replaceAll("{{INVOICE_NUMBER}}", escapeHtml(invoice.invoice_number || ""))

    .replaceAll("{{CUSTOMER_NAME}}", escapeHtml(invoice.customer_name || ""))

    .replaceAll(
      "{{CUSTOMER_ADDRESS}}",
      escapeHtml(invoice.customer_address || ""),
    )

    .replaceAll("{{CUSTOMER_ZIP}}", escapeHtml(invoice.customer_zip || ""))

    .replaceAll("{{CUSTOMER_CITY}}", escapeHtml(invoice.customer_city || ""))

    .replaceAll("{{EVENT_NAME}}", escapeHtml(invoice.event_name || ""))

    .replace("{{ITEM_ROWS}}", itemRows)

    .replaceAll("{{TOTAL}}", formatCurrency(invoice.total));

  // ---------------------------------------------------
  // PDF erzeugen
  // ---------------------------------------------------

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
  } finally {
    await browser.close();
  }
}

// =====================================================
// WÄHRUNG
// =====================================================

function formatCurrency(value) {
  return (
    Number(value || 0).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

// =====================================================
// DATUM
// =====================================================

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("de-DE");
}

// =====================================================
// HTML SICHERN
// =====================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = {
  createInvoicePdf,
};
