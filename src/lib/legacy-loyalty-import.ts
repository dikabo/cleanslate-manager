export type LegacyPaymentStatus = "paid" | "unpaid" | "unknown";
export type LegacyDeliveryStatus = "delivered" | "not_delivered" | "unknown";

export interface LegacyImportRow {
  id: string;
  source_sheet: string;
  source_row: number;
  transaction_date: string | null;
  raw_name: string;
  normalized_name: string;
  raw_contact: string | null;
  normalized_phones: string[];
  amount: number;
  raw_observation: string | null;
  payment_status: LegacyPaymentStatus;
  delivery_status: LegacyDeliveryStatus;
  quality_flags: string[];
  notes: string | null;
  importable: boolean;
}

export interface LegacyImportSummary {
  fileName: string;
  sheets: Array<{ name: string; rows: number; columns: number }>;
  sourceSheetName: string | null;
  rows: LegacyImportRow[];
  totals: {
    rows: number;
    importableRows: number;
    skippedRows: number;
    amount: number;
    importableAmount: number;
    missingContactRows: number;
    anomalyRows: number;
    paidDeliveredRows: number;
  };
  monthlyTotals: Array<{ month: string; amount: number; rows: number }>;
  groupedNames: Array<{ name: string; amount: number; rows: number; variants: string[] }>;
}

type SheetRows = Map<number, Map<number, CellValue>>;
type CellValue = string | number | null;

const MAIN_SOURCE_SHEET = "Feuil1";
const FALLBACK_SOURCE_SHEET = "Feuil2";
const excelEpoch = new Date(Date.UTC(1899, 11, 30));

export async function analyzeLegacyLoyaltyWorkbook(file: File): Promise<LegacyImportSummary> {
  const workbook = await readXlsxWorkbook(await file.arrayBuffer());
  const sourceSheetName = workbook.sheets.has(MAIN_SOURCE_SHEET)
    ? MAIN_SOURCE_SHEET
    : workbook.sheets.has(FALLBACK_SOURCE_SHEET)
      ? FALLBACK_SOURCE_SHEET
      : workbook.sheetOrder[0]?.name ?? null;

  const rows = sourceSheetName
    ? normalizeLegacyRows(sourceSheetName, workbook.sheets.get(sourceSheetName) ?? new Map())
    : [];

  const importableRows = rows.filter((row) => row.importable);
  const monthlyBucket = new Map<string, { amount: number; rows: number }>();

  importableRows.forEach((row) => {
    if (!row.transaction_date) return;
    const month = row.transaction_date.slice(0, 7);
    const current = monthlyBucket.get(month) ?? { amount: 0, rows: 0 };
    current.amount += row.amount;
    current.rows += 1;
    monthlyBucket.set(month, current);
  });

  return {
    fileName: file.name,
    sheets: workbook.sheetOrder.map((sheet) => ({
      name: sheet.name,
      rows: sheet.rows,
      columns: sheet.columns,
    })),
    sourceSheetName,
    rows,
    totals: {
      rows: rows.length,
      importableRows: importableRows.length,
      skippedRows: rows.length - importableRows.length,
      amount: rows.reduce((sum, row) => sum + row.amount, 0),
      importableAmount: importableRows.reduce((sum, row) => sum + row.amount, 0),
      missingContactRows: rows.filter((row) => row.normalized_phones.length === 0).length,
      anomalyRows: rows.filter((row) => row.quality_flags.length > 0).length,
      paidDeliveredRows: rows.filter(
        (row) => row.payment_status === "paid" && row.delivery_status === "delivered",
      ).length,
    },
    monthlyTotals: [...monthlyBucket.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, ...value })),
    groupedNames: groupRowsByName(importableRows).slice(0, 30),
  };
}

function normalizeLegacyRows(sheetName: string, rows: SheetRows): LegacyImportRow[] {
  const output: LegacyImportRow[] = [];
  const maxRow = Math.max(0, ...rows.keys());

  for (let rowIndex = 2; rowIndex <= maxRow; rowIndex += 1) {
    const row = rows.get(rowIndex);
    if (!row || isRowEmpty(row)) continue;

    const rawDate = row.get(1) ?? null;
    const rawName = stringify(row.get(2)).trim();
    const rawContact = stringify(row.get(3)).trim();
    const rawAmount = row.get(4) ?? null;
    const rawObservation = stringify(row.get(5)).trim();
    const extraNotes = [6, 7, 8, 9, 10]
      .map((column) => stringify(row.get(column)).trim())
      .filter(Boolean);

    const transactionDate = normalizeDate(rawDate);
    const amount = normalizeAmount(rawAmount);
    const qualityFlags: string[] = [];
    const phones = normalizePhones(rawContact);
    const observationFlags = normalizeObservation(rawObservation);

    if (!transactionDate) qualityFlags.push("missing_date");
    if (!rawName) qualityFlags.push("missing_name");
    if (rawContact && phones.length === 0) qualityFlags.push("invalid_contact");
    if (!rawContact) qualityFlags.push("missing_contact");
    if (rawAmount !== null && rawAmount !== "" && amount === 0) qualityFlags.push("invalid_amount");
    if (amount <= 0) qualityFlags.push("missing_amount");

    extraNotes.forEach((note) => {
      const normalized = normalizeFreeText(note);
      if (normalized.includes("pas trouve")) qualityFlags.push("not_found");
      if (normalized.includes("confu")) qualityFlags.push("confusing_match");
      if (normalized === "pt" || normalized === "tp") qualityFlags.push("manual_note");
    });

    const importable = Boolean(transactionDate && rawName && amount > 0);

    output.push({
      id: `${sheetName}-${rowIndex}`,
      source_sheet: sheetName,
      source_row: rowIndex,
      transaction_date: transactionDate,
      raw_name: rawName,
      normalized_name: normalizeName(rawName),
      raw_contact: rawContact || null,
      normalized_phones: phones,
      amount,
      raw_observation: rawObservation || null,
      payment_status: observationFlags.paymentStatus,
      delivery_status: observationFlags.deliveryStatus,
      quality_flags: [...new Set(qualityFlags)],
      notes: extraNotes.length > 0 ? extraNotes.join(" | ") : null,
      importable,
    });
  }

  return output;
}

function groupRowsByName(rows: LegacyImportRow[]) {
  const grouped = new Map<string, { name: string; amount: number; rows: number; variants: Set<string> }>();

  rows.forEach((row) => {
    const key = row.normalized_name || row.raw_name;
    const current = grouped.get(key) ?? {
      name: row.raw_name,
      amount: 0,
      rows: 0,
      variants: new Set<string>(),
    };
    current.amount += row.amount;
    current.rows += 1;
    current.variants.add(row.raw_name);
    grouped.set(key, current);
  });

  return [...grouped.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      name: item.name,
      amount: item.amount,
      rows: item.rows,
      variants: [...item.variants].sort((a, b) => a.localeCompare(b)),
    }));
}

function normalizeObservation(value: string): {
  paymentStatus: LegacyPaymentStatus;
  deliveryStatus: LegacyDeliveryStatus;
} {
  const normalized = normalizeFreeText(value);
  const hasPaid = normalized.includes("paye");
  const hasDelivered = normalized.includes("livre") || normalized.includes("livr");

  return {
    paymentStatus: hasPaid ? "paid" : "unknown",
    deliveryStatus: hasDelivered ? "delivered" : "unknown",
  };
}

export function normalizeName(value: string) {
  return normalizeFreeText(value)
    .replace(/\b(mr|mme|mlle|monsieur|madame|m)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFreeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhones(value: string) {
  if (!value.trim()) return [];

  return value
    .split(/[\/;,|\s]+/)
    .map((part) => {
      const scientific = part.match(/^\d+(\.\d+)?e\+?\d+$/i);
      const readable = scientific ? String(Math.trunc(Number(part))) : part;
      return readable.replace(/\D/g, "");
    })
    .filter((phone) => phone.length >= 8)
    .map((phone) => {
      if (phone.startsWith("237")) return phone;
      if (phone.length === 9 && phone.startsWith("6")) return `237${phone}`;
      return phone;
    })
    .filter((phone, index, all) => all.indexOf(phone) === index);
}

function normalizeAmount(value: CellValue) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = stringify(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: CellValue) {
  if (typeof value === "number") return excelDateToIso(value);
  const text = stringify(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function excelDateToIso(serial: number) {
  const date = new Date(excelEpoch.getTime() + Math.round(serial) * 86400000);
  return date.toISOString().slice(0, 10);
}

function stringify(value: CellValue | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function isRowEmpty(row: Map<number, CellValue>) {
  return [...row.values()].every((value) => stringify(value).trim() === "");
}

async function readXlsxWorkbook(buffer: ArrayBuffer) {
  const entries = await unzip(buffer);
  const workbookXml = entries.get("xl/workbook.xml");
  const relsXml = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relsXml) {
    throw new Error("Le fichier ne ressemble pas a un classeur .xlsx valide.");
  }

  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml"));
  const dateStyles = parseDateStyles(entries.get("xl/styles.xml"));
  const sheetRels = parseWorkbookRelationships(relsXml);
  const sheetOrder = parseWorkbookSheets(workbookXml, sheetRels);
  const sheets = new Map<string, SheetRows>();

  sheetOrder.forEach((sheet) => {
    const xml = entries.get(sheet.path);
    if (!xml) return;
    const parsedRows = parseWorksheet(xml, sharedStrings, dateStyles);
    sheets.set(sheet.name, parsedRows.rows);
    sheet.rows = parsedRows.maxRow;
    sheet.columns = parsedRows.maxColumn;
  });

  return { sheetOrder, sheets };
}

function parseSharedStrings(xml?: string) {
  if (!xml) return [];
  const doc = parseXml(xml);
  return [...doc.getElementsByTagName("si")].map((item) =>
    [...item.getElementsByTagName("t")].map((text) => text.textContent ?? "").join(""),
  );
}

function parseDateStyles(xml?: string) {
  const dateStyles = new Set<number>();
  if (!xml) return dateStyles;

  const builtinDateFormats = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  const doc = parseXml(xml);
  const customFormats = new Map<number, string>();

  [...doc.getElementsByTagName("numFmt")].forEach((node) => {
    const id = Number(node.getAttribute("numFmtId"));
    const code = node.getAttribute("formatCode") ?? "";
    if (Number.isFinite(id)) customFormats.set(id, code);
  });

  const cellXfs = doc.getElementsByTagName("cellXfs")[0];
  if (!cellXfs) return dateStyles;

  [...cellXfs.getElementsByTagName("xf")].forEach((node, index) => {
    const numberFormatId = Number(node.getAttribute("numFmtId") ?? 0);
    const customFormat = customFormats.get(numberFormatId) ?? "";
    if (builtinDateFormats.has(numberFormatId) || /[dmyhs]/i.test(customFormat)) {
      dateStyles.add(index);
    }
  });

  return dateStyles;
}

function parseWorkbookRelationships(xml: string) {
  const doc = parseXml(xml);
  const relationships = new Map<string, string>();

  [...doc.getElementsByTagName("Relationship")].forEach((node) => {
    const id = node.getAttribute("Id");
    const target = node.getAttribute("Target");
    if (!id || !target) return;
    relationships.set(id, target.startsWith("xl/") ? target : `xl/${target.replace(/^\/+/, "")}`);
  });

  return relationships;
}

function parseWorkbookSheets(workbookXml: string, relationships: Map<string, string>) {
  const doc = parseXml(workbookXml);

  return [...doc.getElementsByTagName("sheet")].map((node) => {
    const relId =
      node.getAttribute("r:id") ??
      node.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ??
      "";

    return {
      name: node.getAttribute("name") ?? "Feuille",
      path: relationships.get(relId) ?? "",
      rows: 0,
      columns: 0,
    };
  });
}

function parseWorksheet(xml: string, sharedStrings: string[], dateStyles: Set<number>) {
  const doc = parseXml(xml);
  const output: SheetRows = new Map();
  let maxRow = 0;
  let maxColumn = 0;

  [...doc.getElementsByTagName("row")].forEach((rowNode) => {
    const rowIndex = Number(rowNode.getAttribute("r"));
    if (!Number.isFinite(rowIndex)) return;
    const cells = new Map<number, CellValue>();

    [...rowNode.getElementsByTagName("c")].forEach((cellNode) => {
      const ref = cellNode.getAttribute("r") ?? "";
      const column = columnRefToNumber(ref.replace(/\d+/g, ""));
      if (!column) return;

      const value = readCellValue(cellNode, sharedStrings, dateStyles);
      cells.set(column, value);
      maxColumn = Math.max(maxColumn, column);
    });

    if (cells.size > 0) {
      output.set(rowIndex, cells);
      maxRow = Math.max(maxRow, rowIndex);
    }
  });

  return { rows: output, maxRow, maxColumn };
}

function readCellValue(cellNode: Element, sharedStrings: string[], dateStyles: Set<number>): CellValue {
  const type = cellNode.getAttribute("t");
  const style = Number(cellNode.getAttribute("s") ?? -1);
  const valueNode = cellNode.getElementsByTagName("v")[0];

  if (type === "s" && valueNode?.textContent) {
    return sharedStrings[Number(valueNode.textContent)] ?? "";
  }

  if (type === "inlineStr") {
    return [...cellNode.getElementsByTagName("t")].map((node) => node.textContent ?? "").join("");
  }

  const rawValue = valueNode?.textContent ?? "";
  if (!rawValue) return "";

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return rawValue;

  if (dateStyles.has(style) && parsed > 20000 && parsed < 80000) {
    return excelDateToIso(parsed);
  }

  return parsed;
}

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function columnRefToNumber(ref: string) {
  return ref.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

async function unzip(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries = new Map<string, string>();
  const eocdOffset = findEndOfCentralDirectory(view);

  if (eocdOffset < 0) throw new Error("Archive .xlsx illisible.");

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let centralOffset = view.getUint32(eocdOffset + 16, true);

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) {
      throw new Error("Structure ZIP inattendue dans le fichier Excel.");
    }

    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const fileNameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localHeaderOffset = view.getUint32(centralOffset + 42, true);
    const fileName = decodeText(bytes.slice(centralOffset + 46, centralOffset + 46 + fileNameLength));

    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    if (fileName.endsWith(".xml") || fileName.endsWith(".rels")) {
      const data = method === 0 ? compressed : await inflateRaw(compressed);
      entries.set(fileName, decodeText(data));
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(view: DataView) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }

  return -1;
}

async function inflateRaw(data: Uint8Array) {
  const DecompressionStreamCtor = (globalThis as typeof globalThis & {
    DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array>;
  }).DecompressionStream;

  if (!DecompressionStreamCtor) {
    throw new Error("Ce navigateur ne peut pas lire les fichiers .xlsx sans bibliotheque ZIP.");
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStreamCtor("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeText(data: Uint8Array) {
  return new TextDecoder("utf-8").decode(data);
}
