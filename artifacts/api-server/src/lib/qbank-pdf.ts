import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type QbankOcrLanguage = "eng" | "fra" | "ara" | "eng+fra" | "eng+ara" | "eng+fra+ara";

export interface ParsedQbankQuestion {
  questionNumber: number;
  question: string;
  options: [string, string, string, string, string];
  correct: number;
  comment: string;
  imageUrl: string | null;
  warnings: string[];
}

export class QbankPdfProcessingError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = "QbankPdfProcessingError";
  }
}

const MAX_PDF_PAGES = 60;
const MAX_COMMAND_OUTPUT = 12 * 1024 * 1024;

function runCommand(command: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFileCallback(
      command,
      args,
      { encoding: "utf8", timeout, maxBuffer: MAX_COMMAND_OUTPUT },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(String(stderr || error.message)));
          return;
        }
        resolve(String(stdout));
      },
    );
  });
}

function hasSelectableText(text: string): boolean {
  return (text.match(/\p{L}/gu) ?? []).length >= 15;
}

export async function extractPdfQuestionText(
  buffer: Buffer,
  language: QbankOcrLanguage,
): Promise<{ text: string; totalPages: number; ocrPages: number }> {
  const workDir = await mkdtemp(join(tmpdir(), "preclinik-qbank-"));
  const pdfPath = join(workDir, "upload.pdf");

  try {
    await writeFile(pdfPath, buffer);
    const pdfInfo = await runCommand("pdfinfo", [pdfPath], 15_000);
    const pageCount = Number(pdfInfo.match(/^Pages:\s+(\d+)\s*$/m)?.[1]);
    if (!Number.isInteger(pageCount) || pageCount < 1) {
      throw new QbankPdfProcessingError("This PDF has no readable pages.");
    }
    if (pageCount > MAX_PDF_PAGES) {
      throw new QbankPdfProcessingError(
        `This PDF has ${pageCount} pages. Split it into files of ${MAX_PDF_PAGES} pages or fewer.`,
        413,
      );
    }

    const pageTexts: string[] = [];
    let ocrPages = 0;

    for (let page = 1; page <= pageCount; page += 1) {
      let pageText = await runCommand(
        "pdftotext",
        ["-f", String(page), "-l", String(page), "-layout", pdfPath, "-"],
        20_000,
      );

      if (!hasSelectableText(pageText)) {
        const imagePrefix = join(workDir, `page-${page}`);
        await runCommand(
          "pdftoppm",
          ["-f", String(page), "-l", String(page), "-r", "200", "-png", "-singlefile", pdfPath, imagePrefix],
          30_000,
        );
        pageText = await runCommand(
          "tesseract",
          [`${imagePrefix}.png`, "stdout", "-l", language, "--psm", "6"],
          45_000,
        );
        ocrPages += 1;
      }

      pageTexts.push(pageText.trim());
    }

    return { text: pageTexts.join("\n\n"), totalPages: pageCount, ocrPages };
  } catch (error) {
    if (error instanceof QbankPdfProcessingError) throw error;
    throw new QbankPdfProcessingError(
      "Could not read this PDF. Check that it is not damaged or password-protected, then try again.",
    );
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function questionStart(line: string): { number: number; text: string } | null {
  const titled = line.match(/^\s*(?:question|q)\s*#?\s*(\d{1,4})\s*(?:[:.)\-–]\s*)?(.*)$/i);
  if (titled) return { number: Math.max(1, Number(titled[1])), text: titled[2].trim() };

  const numbered = line.match(/^\s*(\d{1,4})[.)\-]\s+(.+)$/);
  if (numbered) return { number: Math.max(1, Number(numbered[1])), text: numbered[2].trim() };

  return null;
}

function normalizeImageUrl(value: string): string | null {
  const cleaned = value.replace(/[),.;!?]+$/g, "");
  const candidate = /^www\./i.test(cleaned) ? `https://${cleaned}` : cleaned;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseQuestionBlock(
  number: number,
  lines: string[],
): ParsedQbankQuestion | null {
  const stem: string[] = [];
  const options: string[] = [];
  const explanation: string[] = [];
  const warnings: string[] = [];
  let optionIndex = -1;
  let inExplanation = false;
  let correct: number | null = null;
  let imageUrl: string | null = null;

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    const optionMatch = line.match(/^\s*([A-E])[.)]\s*(.*)$/i);
    if (optionMatch) {
      inExplanation = false;
      options.push(optionMatch[2].trim());
      optionIndex = options.length - 1;
      continue;
    }

    const answerMatch = line.match(
      /^\s*(?:(?:correct|right)\s+)?(?:answer|option|ans|correct)\s*[:=\-]?\s*\(?([A-E])\)?(?:\b|$)/i,
    );
    if (answerMatch) {
      correct = answerMatch[1].toUpperCase().charCodeAt(0) - 65;
      optionIndex = -1;
      continue;
    }

    const explanationMatch = line.match(/^\s*(?:explanation|commentary|rationale|comment)\s*[:\-]\s*(.*)$/i);
    if (explanationMatch) {
      inExplanation = true;
      optionIndex = -1;
      if (explanationMatch[1]) explanation.push(explanationMatch[1].trim());
      continue;
    }

    const urls = line.match(/https?:\/\/[^\s<>]+|www\.[^\s<>]+/gi) ?? [];
    if (urls.length) {
      if (urls[0]) imageUrl ??= normalizeImageUrl(urls[0]);
      line = line.replace(/https?:\/\/[^\s<>]+|www\.[^\s<>]+/gi, "").trim();
      line = line.replace(/(?:image|diagram|figure)?\s*(?:url|link)\s*[:\-]?\s*$/i, "").trim();
      if (!line) continue;
    }

    if (inExplanation) {
      explanation.push(line);
    } else if (optionIndex >= 0) {
      options[optionIndex] = [options[optionIndex], line].filter(Boolean).join(" ");
    } else {
      stem.push(line);
    }
  }

  if (options.length < 2) return null;
  if (options.length > 5) warnings.push("More than five answer options were found; check the options before saving.");
  if (correct === null || correct >= Math.min(options.length, 5)) {
    correct = 0;
    warnings.push("No valid answer key was detected. Confirm the correct option before saving.");
  }
  if (stem.length === 0) warnings.push("Question text was not detected. Add it before saving.");

  const paddedOptions = options.slice(0, 5);
  while (paddedOptions.length < 5) paddedOptions.push("");

  return {
    questionNumber: number,
    question: stem.join(" ").replace(/\s+/g, " ").trim(),
    options: paddedOptions as ParsedQbankQuestion["options"],
    correct,
    comment: explanation.join(" ").replace(/\s+/g, " ").trim(),
    imageUrl,
    warnings,
  };
}

export function parseQbankText(text: string): ParsedQbankQuestion[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n")
    .split("\n");
  const blocks: Array<{ number: number; lines: string[] }> = [];
  let current: { number: number; lines: string[] } | null = null;

  for (const line of lines) {
    const start = questionStart(line);
    if (start) {
      if (current) blocks.push(current);
      current = { number: start.number, lines: start.text ? [start.text] : [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  return blocks
    .map((block) => parseQuestionBlock(block.number, block.lines))
    .filter((question): question is ParsedQbankQuestion => question !== null);
}
