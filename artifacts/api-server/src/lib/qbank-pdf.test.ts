import assert from "node:assert/strict";
import test from "node:test";
import { extractPdfQuestionText, parseQbankText } from "./qbank-pdf";

function makeTextPdf(lines: string[]): Buffer {
  const escapedLines = lines.map((line) => line.replace(/([\\()])/g, "\\$1"));
  const textOperations = escapedLines
    .map((line, index) => `${index === 0 ? "72 740 Td" : "0 -16 Td"} (${line}) Tj`)
    .join("\n");
  const stream = `BT\n/F1 12 Tf\n${textOperations}\nET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ];

  let pdf = Buffer.from("%PDF-1.4\n");
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf = Buffer.concat([pdf, Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`)]);
  });

  const xrefOffset = pdf.length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");

  return Buffer.concat([pdf, Buffer.from(xref)]);
}

test("extracts selectable PDF text locally without invoking OCR", async () => {
  const pdf = makeTextPdf([
    "Question 1: Which answer is correct?",
    "A. First",
    "B. Second",
    "C. Third",
    "D. Fourth",
    "E. Fifth",
    "Correct answer: B",
  ]);

  const extracted = await extractPdfQuestionText(pdf, "eng+fra");
  const questions = parseQbankText(extracted.text);

  assert.equal(extracted.totalPages, 1);
  assert.equal(extracted.ocrPages, 0);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].correct, 1);
});

test("parses numbered questions, five options, answer, explanation, and image link", () => {
  const [question] = parseQbankText(`Question 7: Which finding is expected?
A. First answer
B) Second answer
C. Third answer
D. Fourth answer
E. Fifth answer
Correct answer: C
Explanation: The third finding is expected.
Image link: https://example.org/diagram.png`);

  assert.equal(question.questionNumber, 7);
  assert.equal(question.question, "Which finding is expected?");
  assert.deepEqual(question.options, [
    "First answer",
    "Second answer",
    "Third answer",
    "Fourth answer",
    "Fifth answer",
  ]);
  assert.equal(question.correct, 2);
  assert.equal(question.comment, "The third finding is expected.");
  assert.equal(question.imageUrl, "https://example.org/diagram.png");
  assert.deepEqual(question.warnings, []);
});

test("flags missing answer keys and skips prose that is not a question", () => {
  const questions = parseQbankText(`Introduction
This paragraph has no answer options.

2) Pick the best response.
A. Alpha
B. Beta`);

  assert.equal(questions.length, 1);
  assert.equal(questions[0].questionNumber, 2);
  assert.equal(questions[0].correct, 0);
  assert.deepEqual(questions[0].warnings, [
    "No valid answer key was detected. Confirm the correct option before saving.",
  ]);
});

test("does not treat unsafe or malformed image links as image URLs", () => {
  const [question] = parseQbankText(`Q4. Which statement is correct?
A. One
B. Two
Answer: B
Image: javascript:alert(1)`);

  assert.equal(question.imageUrl, null);
  assert.equal(question.correct, 1);
});
