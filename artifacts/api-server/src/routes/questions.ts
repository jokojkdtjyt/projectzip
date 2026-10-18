import { Router, type IRouter, type Request, type RequestHandler, type Response } from "express";
import { eq, and } from "drizzle-orm";
import multer from "multer";
import { db, modulesTable, questionsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  extractPdfQuestionText,
  parseQbankText,
  QbankPdfProcessingError,
  type QbankOcrLanguage,
} from "../lib/qbank-pdf";
import {
  ListQuestionsParams,
  CreateQuestionParams,
  CreateQuestionBody,
  UpdateQuestionParams,
  UpdateQuestionBody,
  DeleteQuestionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
const supportedOcrLanguages = new Set<QbankOcrLanguage>([
  "eng",
  "fra",
  "ara",
  "eng+fra",
  "eng+ara",
  "eng+fra+ara",
]);

function hasValidQuestionImageUrl(imageUrl: string | null | undefined): boolean {
  if (imageUrl == null || imageUrl.trim() === "") return true;
  try {
    const url = new URL(imageUrl);
    return (url.protocol === "https:" || url.protocol === "http:") && imageUrl.length <= 2048;
  } catch {
    return false;
  }
}

function hasValidQuestionNumber(questionNumber: number | null | undefined): boolean {
  return questionNumber == null || (Number.isInteger(questionNumber) && questionNumber >= 1);
}

const handlePdfUpload: RequestHandler = (req, res, next) => {
  pdfUpload.single("file")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({
        error: status === 413 ? "PDF files must be 25 MB or smaller." : error.message,
      });
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
};

router.post(
  "/modules/:moduleId/questions/parse-pdf",
  requireAdmin,
  handlePdfUpload,
  async (req: Request, res: Response): Promise<void> => {
    const moduleId = req.params.moduleId;
    if (typeof moduleId !== "string" || !moduleId.trim()) {
      res.status(400).json({ error: "A module is required." });
      return;
    }

    const [module] = await db
      .select({ id: modulesTable.id })
      .from(modulesTable)
      .where(eq(modulesTable.id, moduleId))
      .limit(1);
    if (!module) {
      res.status(404).json({ error: "Module not found." });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Choose a PDF file to import." });
      return;
    }
    if (req.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      res.status(415).json({ error: "The selected file is not a valid PDF." });
      return;
    }

    const languageInput = req.body?.ocrLanguage;
    const ocrLanguage = (typeof languageInput === "string" && languageInput
      ? languageInput
      : "eng+fra") as QbankOcrLanguage;
    if (!supportedOcrLanguages.has(ocrLanguage)) {
      res.status(400).json({ error: "Choose a supported OCR language." });
      return;
    }

    try {
      const extracted = await extractPdfQuestionText(req.file.buffer, ocrLanguage);
      const questions = parseQbankText(extracted.text);
      if (questions.length === 0) {
        res.status(422).json({
          error: "No multiple-choice questions were detected. Check the PDF layout or add the questions manually.",
        });
        return;
      }

      res.json({
        totalPages: extracted.totalPages,
        ocrPages: extracted.ocrPages,
        questions,
      });
    } catch (error) {
      if (error instanceof QbankPdfProcessingError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  },
);

router.get("/modules/:moduleId/lessons/:lessonId/questions", async (req, res): Promise<void> => {
  const params = ListQuestionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.lessonId, params.data.lessonId))
    .orderBy(questionsTable.id);

  res.json(questions);
});

router.post("/modules/:moduleId/lessons/:lessonId/questions", requireAdmin, async (req, res): Promise<void> => {
  const params = CreateQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!hasValidQuestionImageUrl(parsed.data.imageUrl) || !hasValidQuestionNumber(parsed.data.questionNumber)) {
    res.status(400).json({ error: "Question numbers must be whole numbers from 1, and image links must use HTTP or HTTPS." });
    return;
  }

  const [question] = await db
    .insert(questionsTable)
    .values({ ...parsed.data, lessonId: params.data.lessonId })
    .returning();

  res.status(201).json(question);
});

router.patch("/modules/:moduleId/lessons/:lessonId/questions/:questionId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!hasValidQuestionImageUrl(parsed.data.imageUrl) || !hasValidQuestionNumber(parsed.data.questionNumber)) {
    res.status(400).json({ error: "Question numbers must be whole numbers from 1, and image links must use HTTP or HTTPS." });
    return;
  }

  const [question] = await db
    .update(questionsTable)
    .set(parsed.data)
    .where(
      and(
        eq(questionsTable.id, params.data.questionId),
        eq(questionsTable.lessonId, params.data.lessonId)
      )
    )
    .returning();

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  res.json(question);
});

router.delete("/modules/:moduleId/lessons/:lessonId/questions/:questionId", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [question] = await db
    .delete(questionsTable)
    .where(
      and(
        eq(questionsTable.id, params.data.questionId),
        eq(questionsTable.lessonId, params.data.lessonId)
      )
    )
    .returning();

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
