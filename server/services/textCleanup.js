const HEADER_ALIASES = new Map([
  ["contact", "CONTACT"],
  ["profile", "PROFILE"],
  ["summary", "SUMMARY"],
  ["objective", "SUMMARY"],
  ["skills", "SKILLS"],
  ["skill", "SKILLS"],
  ["work experience", "WORK EXPERIENCE"],
  ["experience", "WORK EXPERIENCE"],
  ["employment history", "WORK EXPERIENCE"],
  ["education", "EDUCATION"],
  ["certifications", "CERTIFICATIONS"],
  ["certification", "CERTIFICATIONS"],
  ["references", "REFERENCE"],
  ["reference", "REFERENCE"]
]);

const SECTION_ORDER = [
  "CONTACT",
  "PROFILE",
  "SUMMARY",
  "SKILLS",
  "WORK EXPERIENCE",
  "EDUCATION",
  "CERTIFICATIONS",
  "REFERENCE"
];

const isHeaderLine = (line) => {
  const normalized = String(line || "").trim().toLowerCase().replace(/[:\-]+$/, "");
  if (!normalized) return false;
  return HEADER_ALIASES.has(normalized);
};

const normalizeHeader = (line) => {
  const normalized = String(line || "").trim().toLowerCase().replace(/[:\-]+$/, "");
  return HEADER_ALIASES.get(normalized) || line;
};

const isBulletLine = (line) => /^[\-\u2022*]\s+/.test(line);

const endsWithSentence = (line) => /[.!?:;)]$/.test(line);

const startsLowercase = (line) => /^[a-z]/.test(line);

const normalizeOcrText = (text) =>
  String(text || "")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/\s+:/g, ":")
    .replace(/\s+;/g, ";");

const normalizeLines = (lines) =>
  lines
    .map((line) => String(line || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

const detectMultiColumnLines = (lines) => {
  if (!lines.length) return false;
  const multiLines = lines.filter((line) => {
    const parts = line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
    return parts.length >= 2;
  });
  return multiLines.length >= 5 && multiLines.length / lines.length >= 0.2;
};

const separateColumns = (lines) => {
  const left = [];
  const right = [];
  let sawRight = false;

  for (const rawLine of lines) {
    const parts = rawLine.split(/\s{2,}/);
    const trimmedParts = parts.map((part) => part.trim()).filter(Boolean);

    if (trimmedParts.length >= 2) {
      left.push(trimmedParts[0]);
      right.push(trimmedParts.slice(1).join(" "));
      sawRight = true;
      continue;
    }

    if (trimmedParts.length === 1) {
      const line = trimmedParts[0];
      const isIndented = /^\s{4,}/.test(rawLine);
      if (sawRight && isIndented) {
        right.push(line);
      } else {
        left.push(line);
      }
    }
  }

  if (!right.length) return left;
  return [...left, "", ...right];
};

const cleanupLines = (rawLines) => {
  const cleaned = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    let line = rawLines[i];
    if (!line) continue;

    if (isHeaderLine(line)) {
      const header = normalizeHeader(line);
      if (cleaned.length && cleaned[cleaned.length - 1] !== "") {
        cleaned.push("");
      }
      cleaned.push(header);
      cleaned.push("");
      continue;
    }

    if (/^[\u2022*]/.test(line)) {
      line = `- ${line.replace(/^[\u2022*]\s*/, "")}`;
    }

    // Merge hyphenated line breaks: "communi-" + "cation"
    if (line.endsWith("-") && i + 1 < rawLines.length) {
      const next = rawLines[i + 1];
      if (next && startsLowercase(next)) {
        line = `${line.slice(0, -1)}${next}`;
        i += 1;
      }
    }

    // Merge soft line breaks within a paragraph.
    const next = rawLines[i + 1];
    if (
      next &&
      !isHeaderLine(next) &&
      !isBulletLine(line) &&
      !isBulletLine(next) &&
      !endsWithSentence(line) &&
      startsLowercase(next)
    ) {
      line = `${line} ${next}`;
      i += 1;
    }

    cleaned.push(line);
  }

  return cleaned;
};

const reorderSections = (lines) => {
  const sections = new Map();
  const other = [];
  let currentHeader = null;

  for (const line of lines) {
    if (!line) continue;
    if (isHeaderLine(line)) {
      currentHeader = normalizeHeader(line);
      if (!sections.has(currentHeader)) sections.set(currentHeader, []);
      continue;
    }
    if (!currentHeader) {
      other.push(line);
      continue;
    }
    sections.get(currentHeader).push(line);
  }

  const result = [];
  if (other.length) {
    result.push(...other, "");
  }
  for (const header of SECTION_ORDER) {
    const entries = sections.get(header);
    if (!entries || entries.length === 0) continue;
    result.push(header, "", ...entries, "");
  }
  // Append any unexpected sections at the end.
  for (const [header, entries] of sections.entries()) {
    if (SECTION_ORDER.includes(header)) continue;
    if (!entries.length) continue;
    result.push(header, "", ...entries, "");
  }
  return result;
};

const cleanupExtractedText = (input) => {
  const source = normalizeOcrText(input)
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ");

  const originalLines = source.split(/\n+/).filter((line) => line.trim().length);
  const useColumnSeparation = detectMultiColumnLines(originalLines);
  const columnAdjusted = useColumnSeparation
    ? separateColumns(originalLines)
    : originalLines.map((line) => line.replace(/\s+/g, " ").trim());

  const normalized = normalizeLines(columnAdjusted);
  const cleaned = cleanupLines(normalized);
  const reordered = reorderSections(cleaned);

  return reordered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

module.exports = { cleanupExtractedText };
