import { Router, type IRouter } from "express";
import { eq, and, inArray, isNull, ne, or } from "drizzle-orm";
import { db, lessonsTable, questionsTable, notificationsTable, modulesTable } from "@workspace/db";
import crypto from "node:crypto";
import {
  ListLessonsParams,
  CreateLessonParams,
  CreateLessonBody,
  GetLessonParams,
  UpdateLessonParams,
  UpdateLessonBody,
  DeleteLessonParams,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { isAdminRequest } from "../lib/isAdminRequest";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

async function withQuestionCount(lesson: typeof lessonsTable.$inferSelect) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questionsTable)
    .where(eq(questionsTable.lessonId, lesson.id));
  return { ...lesson, questionCount: Number(row?.count ?? 0) };
}

function normalizedChapterCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

async function validateChapterCode(code: string | null, exceptLessonId?: string) {
  if (!code) return null;
  const [existing] = await db
    .select({ id: lessonsTable.id })
    .from(lessonsTable)
    .where(exceptLessonId
      ? and(eq(lessonsTable.qflowChapterCode, code), ne(lessonsTable.id, exceptLessonId))
      : eq(lessonsTable.qflowChapterCode, code))
    .limit(1);
  return existing ? "That chapter ID is already in use. Choose a unique chapter ID." : null;
}

async function validateChapterLink(sourceLessonId: string, chapterId: string | null) {
  if (!chapterId) return null;
  if (chapterId === sourceLessonId) return "A lesson cannot link its Q-bank to itself.";
  const [hasLinkedLessons] = await db
    .select({ id: lessonsTable.id })
    .from(lessonsTable)
    .where(eq(lessonsTable.qflowChapterId, sourceLessonId))
    .limit(1);
  if (hasLinkedLessons) return "Unlink lessons already assigned to this chapter before linking it elsewhere.";

  const [chapter] = await db
    .select({ id: lessonsTable.id, qflowChapterId: lessonsTable.qflowChapterId })
    .from(lessonsTable)
    .where(eq(lessonsTable.id, chapterId))
    .limit(1);
  if (!chapter) return "The selected QFLOW chapter no longer exists.";
  if (chapter.qflowChapterId) return "Choose a top-level QFLOW chapter, not a lesson already linked elsewhere.";
  return null;
}

// ── GET /modules/:moduleId/lessons ─────────────────────────────────────────────
// Admins see all lessons (including draft). Students only see published ones.
router.get("/modules/:moduleId/lessons", async (req, res): Promise<void> => {
  const params = ListLessonsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const admin = await isAdminRequest(req);

  const conditions = [eq(lessonsTable.moduleId, params.data.moduleId)];
  if (!admin) {
    // Students (and admins in student-preview mode) only see published lessons
    conditions.push(eq(lessonsTable.published, true));
  }

  const lessons = await db
    .select()
    .from(lessonsTable)
    .where(and(...conditions))
    .orderBy(lessonsTable.sortOrder);

  const lessonIds = lessons.map((l) => l.id);
  const questionCounts = lessonIds.length > 0
    ? await db
        .select({
          lessonId: questionsTable.lessonId,
          count: sql<number>`count(*)::int`,
        })
        .from(questionsTable)
        .where(inArray(questionsTable.lessonId, lessonIds))
        .groupBy(questionsTable.lessonId)
    : [];

  const countMap = new Map<string, number>();
  for (const row of questionCounts) {
    countMap.set(row.lessonId, Number(row.count));
  }

  const result = lessons.map((l) => ({ ...l, questionCount: countMap.get(l.id) ?? 0 }));
  res.json(result);
});

// QFLOW presents only top-level chapters. Questions from linked lessons are
// counted under their destination chapter instead of appearing as duplicates.
router.get("/qflow/modules/:moduleId/chapters", async (req, res): Promise<void> => {
  const params = ListLessonsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const admin = await isAdminRequest(req);
  const conditions = [
    eq(lessonsTable.moduleId, params.data.moduleId),
    isNull(lessonsTable.qflowChapterId),
  ];
  if (!admin) conditions.push(eq(lessonsTable.published, true));

  const chapters = await db
    .select()
    .from(lessonsTable)
    .where(and(...conditions))
    .orderBy(lessonsTable.sortOrder);
  if (!chapters.length) {
    res.json([]);
    return;
  }

  const chapterIds = chapters.map((chapter) => chapter.id);
  const questionCounts = await db
    .select({
      chapterId: sql<string>`coalesce(${lessonsTable.qflowChapterId}, ${lessonsTable.id})`,
      count: sql<number>`count(${questionsTable.id})::int`,
    })
    .from(questionsTable)
    .innerJoin(lessonsTable, eq(questionsTable.lessonId, lessonsTable.id))
    .where(and(
      inArray(sql<string>`coalesce(${lessonsTable.qflowChapterId}, ${lessonsTable.id})`, chapterIds),
      ...(admin ? [] : [eq(lessonsTable.published, true)]),
    ))
    .groupBy(sql`coalesce(${lessonsTable.qflowChapterId}, ${lessonsTable.id})`);
  const countMap = new Map(questionCounts.map((row) => [row.chapterId, Number(row.count)]));
  const linkedLessonRows = await db
    .select({
      chapterId: lessonsTable.qflowChapterId,
      id: lessonsTable.id,
      moduleId: lessonsTable.moduleId,
      title: lessonsTable.title,
      type: lessonsTable.type,
      duration: lessonsTable.duration,
      published: lessonsTable.published,
    })
    .from(lessonsTable)
    .where(and(
      inArray(lessonsTable.qflowChapterId, chapterIds),
      ...(admin ? [] : [eq(lessonsTable.published, true)]),
    ))
    .orderBy(lessonsTable.sortOrder);
  const linkedLessonsByChapter = new Map<string, typeof linkedLessonRows>();
  for (const lesson of linkedLessonRows) {
    if (!lesson.chapterId) continue;
    const linked = linkedLessonsByChapter.get(lesson.chapterId) ?? [];
    linked.push(lesson);
    linkedLessonsByChapter.set(lesson.chapterId, linked);
  }
  res.json(chapters.map((chapter) => ({
    ...chapter,
    questionCount: countMap.get(chapter.id) ?? 0,
    linkedLessons: linkedLessonsByChapter.get(chapter.id) ?? [],
  })));
});

router.get("/qflow/modules/:moduleId/chapters/:chapterId/questions", async (req, res): Promise<void> => {
  const params = GetLessonParams.safeParse({
    moduleId: req.params.moduleId,
    lessonId: req.params.chapterId,
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const admin = await isAdminRequest(req);
  const chapterConditions = [
    eq(lessonsTable.id, params.data.lessonId),
    eq(lessonsTable.moduleId, params.data.moduleId),
    isNull(lessonsTable.qflowChapterId),
  ];
  if (!admin) chapterConditions.push(eq(lessonsTable.published, true));
  const [chapter] = await db
    .select({ id: lessonsTable.id })
    .from(lessonsTable)
    .where(and(...chapterConditions))
    .limit(1);
  if (!chapter) {
    res.status(404).json({ error: "QFLOW chapter not found" });
    return;
  }

  const questionConditions = [
    or(
      eq(lessonsTable.id, chapter.id),
      eq(lessonsTable.qflowChapterId, chapter.id),
    )!,
  ];
  if (!admin) questionConditions.push(eq(lessonsTable.published, true));
  const questions = await db
    .select({
      id: questionsTable.id,
      lessonId: questionsTable.lessonId,
      question: questionsTable.question,
      options: questionsTable.options,
      correct: questionsTable.correct,
      comment: questionsTable.comment,
      questionNumber: questionsTable.questionNumber,
      imageUrl: questionsTable.imageUrl,
    })
    .from(questionsTable)
    .innerJoin(lessonsTable, eq(questionsTable.lessonId, lessonsTable.id))
    .where(and(...questionConditions))
    .orderBy(questionsTable.id);
  res.json(questions);
});

router.post("/modules/:moduleId/lessons", requireAdmin, async (req, res): Promise<void> => {
  const params = CreateLessonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateLessonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const chapterCode = normalizedChapterCode(parsed.data.qflowChapterCode);
  const codeError = await validateChapterCode(chapterCode);
  if (codeError) {
    res.status(409).json({ error: codeError });
    return;
  }
  const linkError = await validateChapterLink(parsed.data.id, parsed.data.qflowChapterId ?? null);
  if (linkError) {
    res.status(400).json({ error: linkError });
    return;
  }

  const [lesson] = await db
    .insert(lessonsTable)
    .values({
      ...parsed.data,
      qflowChapterCode: chapterCode,
      qflowChapterId: parsed.data.qflowChapterId ?? null,
      moduleId: params.data.moduleId,
    })
    .returning();

  // Look up the parent module title for the notification body
  const [parentMod] = await db
    .select({ title: modulesTable.title })
    .from(modulesTable)
    .where(eq(modulesTable.id, params.data.moduleId));

  // Global notification — all students see this
  await db.insert(notificationsTable).values({
    id: crypto.randomUUID(),
    userId: null,
    type: "new_lesson",
    title: "New lesson added 🎬",
    body: `"${lesson.title}" is now available${parentMod ? ` in ${parentMod.title}` : ""}.`,
    moduleId: params.data.moduleId,
  });

  res.status(201).json({ ...lesson, questionCount: 0 });
});

// ── GET /modules/:moduleId/lessons/:lessonId ───────────────────────────────────
// Draft lessons are 404 for students (and admins in student-preview mode).
router.get("/modules/:moduleId/lessons/:lessonId", async (req, res): Promise<void> => {
  const params = GetLessonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const admin = await isAdminRequest(req);

  const conditions = [
    eq(lessonsTable.id, params.data.lessonId),
    eq(lessonsTable.moduleId, params.data.moduleId),
  ];
  if (!admin) {
    conditions.push(eq(lessonsTable.published, true));
  }

  const [lesson] = await db
    .select()
    .from(lessonsTable)
    .where(and(...conditions));

  if (!lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  res.json(await withQuestionCount(lesson));
});

router.patch("/modules/:moduleId/lessons/:lessonId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateLessonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLessonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingLesson] = await db
    .select()
    .from(lessonsTable)
    .where(and(
      eq(lessonsTable.id, params.data.lessonId),
      eq(lessonsTable.moduleId, params.data.moduleId),
    ))
    .limit(1);
  if (!existingLesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  const chapterCode = parsed.data.qflowChapterCode === undefined
    ? existingLesson.qflowChapterCode
    : normalizedChapterCode(parsed.data.qflowChapterCode);
  const codeError = await validateChapterCode(chapterCode, existingLesson.id);
  if (codeError) {
    res.status(409).json({ error: codeError });
    return;
  }
  const chapterId = parsed.data.qflowChapterId === undefined
    ? existingLesson.qflowChapterId
    : parsed.data.qflowChapterId;
  const linkError = await validateChapterLink(existingLesson.id, chapterId);
  if (linkError) {
    res.status(400).json({ error: linkError });
    return;
  }

  const [lesson] = await db
    .update(lessonsTable)
    .set({
      ...parsed.data,
      qflowChapterCode: chapterCode,
      qflowChapterId: chapterId,
    })
    .where(
      and(
        eq(lessonsTable.id, params.data.lessonId),
        eq(lessonsTable.moduleId, params.data.moduleId)
      )
    )
    .returning();

  if (!lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  res.json(await withQuestionCount(lesson));
});

router.delete("/modules/:moduleId/lessons/:lessonId", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteLessonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [linkedLesson] = await db
    .select({ id: lessonsTable.id })
    .from(lessonsTable)
    .where(eq(lessonsTable.qflowChapterId, params.data.lessonId))
    .limit(1);
  if (linkedLesson) {
    res.status(409).json({ error: "This chapter has linked Q-banks. Unlink them before deleting the chapter." });
    return;
  }

  const [lesson] = await db
    .delete(lessonsTable)
    .where(
      and(
        eq(lessonsTable.id, params.data.lessonId),
        eq(lessonsTable.moduleId, params.data.moduleId)
      )
    )
    .returning();

  if (!lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
