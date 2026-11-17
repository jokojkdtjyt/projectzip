import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import {
  Lesson,
  LessonInput,
  LessonUpdate,
  useCreateLesson,
  useUpdateLesson,
  useListModules,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useParseQbankPdf,
  type ParseQbankPdfBodyOcrLanguage,
  listQuestions,
  listLessons,
  getListLessonsQueryKey,
  getListQuestionsQueryKey,
} from '@workspace/api-client-react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { startUpload } from '@/lib/uploadManager';
import {
  X, Save, Plus, ChevronDown, ChevronUp,
  Trash2, Copy, Film, BookOpen, AlertCircle, Video, FileText, HelpCircle,
  CheckCircle2, Loader2, CloudUpload, Link,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Local Q-bank types ────────────────────────────────────────────────────

let _localIdCounter = 0;
function nextLocalId() { return `local-${++_localIdCounter}`; }

interface LocalQuestion {
  localId: string;
  serverQId?: number;
  q: string;
  options: [string, string, string, string, string];
  correct: number; // 0–4
  comment: string;
  questionNumber: number | null;
  imageUrl: string;
  importWarnings: string[];
  expanded: boolean;
  saved: boolean;
}

function blankQuestion(questionNumber: number): LocalQuestion {
  return {
    localId: nextLocalId(),
    q: '',
    options: ['', '', '', '', ''],
    correct: 0,
    comment: '',
    questionNumber,
    imageUrl: '',
    importWarnings: [],
    expanded: true,
    saved: false,
  };
}

// ─── Main form schema ──────────────────────────────────────────────────────

interface VideoFormData {
  title: string;
  duration: string;
  type: 'Video' | 'Reading' | 'Quiz';
  published: boolean;
  videoTitle: string;
  videoUrl: string;
  youtubeUrl: string;
  isFree: boolean;
  summary: string;
  qflowChapterCode: string;
  qflowChapterId: string;
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ContextCard({ moduleId, modules }: { moduleId: string; modules: any[] }) {
  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/60 border border-border mb-6">
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <BookOpen className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Module context</div>
        <div className="font-bold text-foreground text-sm truncate">{mod.title}</div>
      </div>
      {mod.year && (
        <div className="ml-auto shrink-0 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono font-bold">
          Year {mod.year}
        </div>
      )}
    </div>
  );
}

// ─── Bunny video uploader ──────────────────────────────────────────────────

interface BunnyUploaderProps {
  lessonId: string | null;
  moduleId: string;
  lessonTitle: string;
  existingBunnyVideoId: string | null;
  onFileStaged: (file: File | null) => void;
  getToken: () => Promise<string | null>;
}

function BunnyUploader({
  lessonId,
  moduleId,
  lessonTitle,
  existingBunnyVideoId,
  onFileStaged,
  getToken,
}: BunnyUploaderProps) {
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [currentBunnyId, setCurrentBunnyId] = useState<string | null>(existingBunnyVideoId);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCurrentBunnyId(existingBunnyVideoId); }, [existingBunnyVideoId]);

  const handleFile = (file: File) => { setStagedFile(file); onFileStaged(file); };

  /** Upload immediately (for existing lessons) — fire-and-forget via global manager. */
  const handleUploadNow = async () => {
    if (!stagedFile || !lessonId) return;
    const token = await getToken();
    startUpload({ lessonId, moduleId, lessonTitle, file: stagedFile, token });
    setStagedFile(null);
    onFileStaged(null);
    toast.info('Upload started — watch the progress bar at the bottom of the screen');
  };

  // ── Already has a video ──
  if (currentBunnyId) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-green-800">Video uploaded to Bunny Stream</div>
            <div className="text-xs font-mono text-green-600 truncate">ID: {currentBunnyId}</div>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="ml-auto shrink-0 text-xs font-bold text-green-700 hover:underline">
            Replace
          </button>
        </div>
        <input ref={fileRef} type="file" accept="video/*" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        {stagedFile && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <CloudUpload className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-mono text-amber-800 truncate flex-1">{stagedFile.name}</span>
            {lessonId
              ? <button type="button" onClick={handleUploadNow}
                  className="shrink-0 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors">
                  Upload now
                </button>
              : <span className="shrink-0 text-xs text-amber-600 font-mono">Will upload on save</span>
            }
          </div>
        )}
      </div>
    );
  }

  // ── No video yet ──
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => fileRef.current?.click()}
        className="w-full border-2 border-dashed border-border rounded-xl p-5 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all text-center cursor-pointer">
        <CloudUpload className="w-7 h-7 text-muted-foreground" />
        {stagedFile
          ? <span className="text-sm font-mono font-bold text-primary">{stagedFile.name}</span>
          : <span className="text-sm text-muted-foreground font-mono">Click to choose a video file</span>
        }
        <span className="text-xs text-muted-foreground font-mono">MP4 · MOV · WebM</span>
      </button>
      <input ref={fileRef} type="file" accept="video/*" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      {stagedFile && (
        <div className="flex items-center gap-2 flex-wrap">
          {lessonId
            ? <button type="button" onClick={handleUploadNow}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
                <CloudUpload className="w-4 h-4" /> Upload to Bunny now
              </button>
            : <span className="text-xs font-mono text-muted-foreground px-3 py-2 rounded-xl bg-secondary border border-border">
                ✓ Staged — will upload to Bunny after lesson is saved
              </span>
          }
          <button type="button" onClick={() => { setStagedFile(null); onFileStaged(null); }}
            className="px-3 py-2 text-xs font-bold text-muted-foreground hover:text-destructive transition-colors">
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionItem({
  q, index, total,
  onChange, onRemove, onDuplicate,
}: {
  q: LocalQuestion; index: number; total: number;
  onChange: (updated: LocalQuestion) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const update = (patch: Partial<LocalQuestion>) => onChange({ ...q, ...patch });
  const setOption = (i: number, val: string) => {
    const opts = [...q.options] as [string, string, string, string, string];
    opts[i] = val;
    update({ options: opts });
  };
  const handleCollapse = () => update({ saved: true, expanded: false });
  const handleSave = () => {
    if (!q.q.trim()) { toast.error('Question text cannot be empty'); return; }
    update({ saved: true, expanded: false, importWarnings: [] });
  };
  const imagePreviewUrl = (() => {
    try {
      const url = new URL(q.imageUrl.trim());
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  })();

  // ── Collapsed/saved view ──
  if (q.saved && !q.expanded) {
    const correctLabel = q.options[q.correct] || `Option ${String.fromCharCode(65 + q.correct)}`;
    return (
      <div
        className="group rounded-xl border border-border bg-white hover:border-primary/30 transition-all cursor-pointer"
        onClick={() => update({ expanded: true })}
      >
        <div className="p-4 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-green-50 text-green-700 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-mono font-bold">Q{q.questionNumber ?? index + 1}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">
              {q.q || <span className="text-muted-foreground italic">No question text</span>}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-mono font-bold border border-green-200">
                ✓ {correctLabel.slice(0, 40)}{correctLabel.length > 40 ? '…' : ''}
              </span>
              {q.imageUrl && (
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-mono border border-blue-200">
                  <Link className="inline w-3 h-3 mr-1" /> Image linked
                </span>
              )}
              {!!q.importWarnings.length && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-mono border border-amber-200">
                  Review {q.importWarnings.length} import warning{q.importWarnings.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button type="button" onClick={(e) => { e.stopPropagation(); update({ expanded: true }); }} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors text-xs font-bold">Edit</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"><Copy className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    );
  }

  // ── Expanded/editing view ──
  const optionLetters = ['A', 'B', 'C', 'D', 'E'];
  return (
    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 shadow-sm">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">
          {q.saved ? `Editing question ${q.questionNumber ?? index + 1}` : `New question ${q.questionNumber ?? index + 1}`}
        </span>
        <button type="button" onClick={onRemove} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-4">
        {!!q.importWarnings.length && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <strong>Review this import:</strong>
            <ul className="mt-1 list-disc pl-5">
              {q.importWarnings.map((warning, warningIndex) => <li key={warningIndex}>{warning}</li>)}
            </ul>
          </div>
        )}

        {/* Manual question number */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Question number</label>
          <input
            type="number"
            min={1}
            step={1}
            value={q.questionNumber ?? ''}
            onChange={(e) => update({ questionNumber: e.target.value ? Math.max(1, Number.parseInt(e.target.value, 10)) : null })}
            className="h-10 w-36 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Question text */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Question text</label>
          <textarea
            value={q.q}
            onChange={(e) => update({ q: e.target.value })}
            rows={3}
            placeholder="Write the clinical or exam-style question here"
            className="w-full p-3 rounded-xl border border-border bg-white focus:ring-2 focus:ring-primary outline-none transition-all resize-none text-sm"
          />
        </div>

        {/* 5 answer options */}
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Answer options — select the correct one</label>
          {optionLetters.map((letter, i) => (
            <label
              key={i}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${q.correct === i ? 'border-green-400 bg-green-50' : 'border-border bg-white hover:bg-secondary/30'}`}
            >
              <input
                type="radio"
                name={`correct-${q.localId}`}
                checked={q.correct === i}
                onChange={() => update({ correct: i })}
                className="accent-green-600 w-4 h-4 shrink-0"
              />
              <span className="w-6 shrink-0 text-xs font-mono font-bold text-muted-foreground">{letter}</span>
              <input
                type="text"
                value={q.options[i]}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${letter}`}
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              />
            </label>
          ))}
        </div>

        {/* Explanation */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Explanation / comment</label>
          <textarea
            value={q.comment}
            onChange={(e) => update({ comment: e.target.value })}
            rows={3}
            placeholder="Explain why the right answer is correct and why the distractors are wrong"
            className="w-full p-3 rounded-xl border border-border bg-white focus:ring-2 focus:ring-primary outline-none transition-all resize-none text-sm"
          />
        </div>

        {/* Optional image link */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Image URL (optional)</label>
          <input
            type="url"
            value={q.imageUrl}
            onChange={(e) => update({ imageUrl: e.target.value })}
            placeholder="https://…"
            className="w-full h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          {imagePreviewUrl && (
            <img
              src={imagePreviewUrl}
              alt="Question illustration preview"
              loading="lazy"
              referrerPolicy="no-referrer"
              className="max-h-64 max-w-full rounded-xl border border-border object-contain"
            />
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleCollapse}
            className="px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-secondary rounded-xl transition-colors border border-border"
          >
            Collapse
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors shadow-sm"
          >
            Save Q{q.questionNumber ?? index + 1}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main LessonEditor component ───────────────────────────────────────────

interface LessonEditorProps {
  moduleId: string;
  lesson: Lesson | null;
  onClose: () => void;
  initialTab?: 'video' | 'qbank';
  initialLinkPickerOpen?: boolean;
  initialLinkModuleId?: string;
}

export function LessonEditor({
  moduleId,
  lesson,
  onClose,
  initialTab = 'video',
  initialLinkPickerOpen = false,
  initialLinkModuleId = '',
}: LessonEditorProps) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const isEditing = !!lesson;

  const [activeTab, setActiveTab] = useState<'video' | 'qbank'>(initialTab);
  const [qbank, setQbank] = useState<LocalQuestion[]>([]);
  const [qbankLoading, setQbankLoading] = useState(!!lesson);
  const [qbankLoadError, setQbankLoadError] = useState(false);
  const [questionLoadAttempt, setQuestionLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [importingPdf, setImportingPdf] = useState(false);
  const [ocrLanguage, setOcrLanguage] = useState<ParseQbankPdfBodyOcrLanguage>('eng+fra');
  const [showQflowLinkPicker, setShowQflowLinkPicker] = useState(initialLinkPickerOpen);
  const [linkModuleId, setLinkModuleId] = useState(initialLinkModuleId);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Video source toggle: 'bunny' | 'youtube'
  const [videoSource, setVideoSource] = useState<'bunny' | 'youtube'>(
    (lesson as any)?.youtubeUrl ? 'youtube' : 'bunny'
  );

  // Bunny video state
  const [stagedVideoFile, setStagedVideoFile] = useState<File | null>(null);
  const [savedLessonId, setSavedLessonId] = useState<string | null>(lesson?.id ?? null);
  const [bunnyVideoId, setBunnyVideoId] = useState<string | null>((lesson as any)?.bunnyVideoId ?? null);

  const { data: modules = [] } = useListModules();
  const moduleLessons = useQueries({
    queries: modules.map((module) => ({
      queryKey: getListLessonsQueryKey(module.id),
      queryFn: () => listLessons(module.id),
    })),
  });
  const chapterChoices = moduleLessons.flatMap((query, index) =>
    (query.data ?? [])
      .filter((candidate) => candidate.id !== lesson?.id && !candidate.qflowChapterId)
      .map((candidate) => ({
        ...candidate,
        moduleTitle: modules[index]?.title ?? candidate.moduleId,
      })),
  );
  const createLessonMut = useCreateLesson();
  const updateLessonMut = useUpdateLesson();
  const createQMut = useCreateQuestion();
  const updateQMut = useUpdateQuestion();
  const deleteQMut = useDeleteQuestion();
  const parsePdfMut = useParseQbankPdf();

  // Form
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<VideoFormData>({
    defaultValues: {
      title: lesson?.title || '',
      duration: lesson?.duration || '',
      type: (lesson?.type as 'Video' | 'Reading' | 'Quiz') || 'Video',
      published: lesson?.published ?? false,
      videoTitle: lesson?.videoTitle || '',
      videoUrl: lesson?.videoUrl || '',
      youtubeUrl: (lesson as any)?.youtubeUrl || '',
      isFree: (lesson as any)?.isFree ?? false,
      summary: lesson?.summary || '',
      qflowChapterCode: lesson?.qflowChapterCode || '',
      qflowChapterId: lesson?.qflowChapterId || '',
    },
  });
  const watchedTitle = watch('title');
  const qflowChapterIdValue = watch('qflowChapterId');
  const linkedChapterChoice = chapterChoices.find((chapter) => chapter.id === qflowChapterIdValue);
  const destinationModuleId = linkedChapterChoice?.moduleId || linkModuleId;
  const destinationModules = [...new Map(
    chapterChoices.map((chapter) => [chapter.moduleId, chapter.moduleTitle]),
  ).entries()].map(([id, title]) => ({ id, title }));

  // Load the existing bank before allowing edits or saves. This prevents a
  // failed or unfinished request from making a PDF import replace old questions.
  useEffect(() => {
    if (!lesson) {
      setQbank([]);
      setQbankLoading(false);
      setQbankLoadError(false);
      return;
    }

    let active = true;
    setQbankLoading(true);
    setQbankLoadError(false);
    listQuestions(moduleId, lesson.id)
      .then((serverQs) => {
        if (!active) return;
        setQbank(
          serverQs.map((sq, index) => ({
            localId: nextLocalId(),
            serverQId: sq.id,
            q: sq.question,
            options: (sq.options as string[]).concat(['', '', '', '', '']).slice(0, 5) as [string, string, string, string, string],
            correct: sq.correct,
            comment: sq.comment || '',
            questionNumber: sq.questionNumber ?? index + 1,
            imageUrl: sq.imageUrl ?? '',
            importWarnings: [],
            expanded: false,
            saved: true,
          }))
        );
      })
      .catch(() => {
        if (!active) return;
        setQbankLoadError(true);
        toast.error('Could not load the existing Q-bank. Retry before editing or saving to protect its questions.');
      })
      .finally(() => {
        if (active) setQbankLoading(false);
      });

    return () => { active = false; };
  }, [moduleId, lesson?.id, questionLoadAttempt]);

  // Q-bank helpers
  const updateQ = useCallback((localId: string, updated: LocalQuestion) => {
    setQbank((prev) => prev.map((q) => q.localId === localId ? updated : q));
  }, []);

  const removeQ = useCallback((localId: string) => {
    setQbank((prev) => prev.filter((q) => q.localId !== localId));
  }, []);

  const duplicateQ = useCallback((localId: string) => {
    setQbank((prev) => {
      const idx = prev.findIndex((q) => q.localId === localId);
      if (idx === -1) return prev;
      const nextQuestionNumber = prev.reduce(
        (largest, question, questionIndex) => Math.max(largest, question.questionNumber ?? questionIndex + 1),
        0,
      ) + 1;
      const clone: LocalQuestion = {
        ...prev[idx],
        localId: nextLocalId(),
        serverQId: undefined,
        q: prev[idx].q + ' (copy)',
        questionNumber: nextQuestionNumber,
        importWarnings: [],
        expanded: true,
        saved: false,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  }, []);

  const addQ = () => setQbank((prev) => {
    const nextQuestionNumber = prev.reduce(
      (largest, question, questionIndex) => Math.max(largest, question.questionNumber ?? questionIndex + 1),
      0,
    ) + 1;
    return [...prev, blankQuestion(nextQuestionNumber)];
  });

  const handlePdfFile = async (file?: File) => {
    if (!file || qbankLoading || qbankLoadError) return;
    setImportingPdf(true);
    try {
      const result = await parsePdfMut.mutateAsync({
        moduleId,
        data: { file, ocrLanguage },
      });
      setQbank((previous) => {
        const lastNumber = previous.reduce(
          (largest, question, index) => Math.max(largest, question.questionNumber ?? index + 1),
          0,
        );
        const importedQuestions = result.questions.map((draft, index) => ({
          localId: nextLocalId(),
          q: draft.question,
          options: draft.options.slice(0, 5) as [string, string, string, string, string],
          correct: draft.correct,
          comment: draft.comment,
          questionNumber: lastNumber + index + 1,
          imageUrl: draft.imageUrl ?? '',
          importWarnings: draft.warnings,
          expanded: true,
          saved: false,
        }));
        return [...previous, ...importedQuestions];
      });
      toast.success(
        `Added ${result.questions.length} question${result.questions.length === 1 ? '' : 's'} to the review list. ` +
        `${result.ocrPages} scanned page${result.ocrPages === 1 ? '' : 's'} processed with local OCR.`,
      );
    } catch (error: any) {
      toast.error(error?.message || 'Could not import questions from this PDF.');
    } finally {
      setImportingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  // Save orchestration
  const onSave = async (formData: VideoFormData) => {
    if (qbankLoading || qbankLoadError) {
      toast.error('Load the existing Q-bank successfully before saving so current questions are protected.');
      return;
    }
    setSaving(true);
    try {
      const lessonPayload: LessonInput = {
        id: lesson?.id || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36),
        title: formData.title,
        duration: formData.duration,
        type: formData.type,
        published: formData.published,
        summary: formData.summary,
        videoTitle: formData.videoTitle || formData.title,
        videoUrl: formData.videoUrl,
        youtubeUrl: videoSource === 'youtube' ? (formData.youtubeUrl || null) : null,
        isFree: formData.isFree,
        sortOrder: lesson?.sortOrder ?? 99,
        qflowChapterCode: formData.qflowChapterCode.trim().toUpperCase() || suggestChapterCode(moduleId, formData.title),
        qflowChapterId: formData.qflowChapterId || null,
      };

      let resolvedLessonId: string;

      if (isEditing) {
        await updateLessonMut.mutateAsync({ moduleId, lessonId: lesson.id, data: lessonPayload as LessonUpdate });
        resolvedLessonId = lesson.id;
      } else {
        const created = await createLessonMut.mutateAsync({ moduleId, data: lessonPayload });
        resolvedLessonId = created.id;
        setSavedLessonId(resolvedLessonId);
      }

      // Kick off background upload (fire-and-forget — XHR lives in uploadManager,
      // not in this component, so closing the drawer won't cancel the transfer).
      if (stagedVideoFile) {
        const token = await getToken();
        startUpload({
          lessonId: resolvedLessonId,
          moduleId,
          lessonTitle: formData.title,
          file: stagedVideoFile,
          token,
        });
        setStagedVideoFile(null);
      }

      // Sync Q-bank
      const serverQs = await listQuestions(moduleId, resolvedLessonId).catch(() => [] as Awaited<ReturnType<typeof listQuestions>>);
      const serverQIds = new Set(serverQs.map((q) => q.id));
      const localServerQIds = new Set(qbank.filter((q) => q.serverQId != null).map((q) => q.serverQId!));

      // Delete removed questions
      const toDelete = serverQs.filter((sq) => !localServerQIds.has(sq.id));
      await Promise.all(toDelete.map((sq) =>
        deleteQMut.mutateAsync({ moduleId, lessonId: resolvedLessonId, questionId: sq.id })
      ));

      // Create or update local questions
      await Promise.all(qbank.map(async (q, index) => {
        const payload = {
          question: q.q || 'Question',
          options: q.options,
          correct: q.correct,
          comment: q.comment,
          questionNumber: q.questionNumber ?? index + 1,
          imageUrl: q.imageUrl.trim() || null,
        };
        if (q.serverQId != null && serverQIds.has(q.serverQId)) {
          await updateQMut.mutateAsync({ moduleId, lessonId: resolvedLessonId, questionId: q.serverQId, data: payload });
        } else if (!q.serverQId) {
          await createQMut.mutateAsync({ moduleId, lessonId: resolvedLessonId, data: payload });
        }
      }));

      queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey(moduleId) });
      queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey(moduleId, resolvedLessonId) });
      toast.success(isEditing ? 'Lesson updated' : 'Lesson created');
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save lesson');
    } finally {
      setSaving(false);
    }
  };

  const lessonType = watch('type');

  // ── Render ──
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[680px] max-w-[95vw] bg-background shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="shrink-0 px-7 py-5 border-b border-border flex items-start justify-between bg-white">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">
              {isEditing ? 'Edit lesson' : 'Add lesson'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Build the video lesson and its lesson-specific Q-bank in one place.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="shrink-0 px-7 pt-4 pb-0 bg-white border-b border-border">
          <div className="flex gap-1">
            {([['video', Film, '1. Video details'], ['qbank', HelpCircle, '2. Lesson Q-bank']] as const).map(([tab, Icon, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-bold transition-all border-b-2 ${
                  activeTab === tab
                    ? 'text-primary border-primary bg-primary/5'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <form id="lesson-save-form" onSubmit={handleSubmit(onSave)}>

            {/* ── TAB 1: Video details ── */}
            {activeTab === 'video' && (
              <div className="p-7 space-y-6">
                {/* Context card */}
                <ContextCard moduleId={moduleId} modules={modules} />

                {/* 1. Lesson name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Lesson name</label>
                  <input
                    {...register('title', { required: 'Lesson name is required' })}
                    placeholder="Write the lesson name here — e.g. Wiggers diagram and valve events"
                    className="w-full h-12 px-4 rounded-xl border border-border bg-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                  />
                  {errors.title && <p className="text-red-500 text-xs">{errors.title.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Stable QFLOW chapter ID</label>
                  <input
                    {...register('qflowChapterCode')}
                    placeholder="e.g. PHY-COM-LIQUID-01"
                    maxLength={80}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-white font-mono uppercase focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {watch('qflowChapterCode')?.trim()
                      ? 'This ID is shown in the admin lesson list and in QFLOW.'
                      : `Leave blank to generate ${suggestChapterCode(moduleId, watchedTitle || 'chapter title')}.`}
                  </p>
                </div>

                {/* 2+3. Duration + Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Duration</label>
                    <input
                      {...register('duration', { required: 'Duration is required' })}
                      placeholder="18 min"
                      className="w-full h-12 px-4 rounded-xl border border-border bg-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                    />
                    {errors.duration && <p className="text-red-500 text-xs">{errors.duration.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Type</label>
                    <select
                      {...register('type')}
                      className="w-full h-12 px-4 rounded-xl border border-border bg-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-bold"
                    >
                      <option value="Video">📹  Video</option>
                      <option value="Reading">📖  Reading</option>
                      <option value="Quiz">❓  Quiz</option>
                    </select>
                  </div>
                </div>

                {/* 4. Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Status</label>
                  <select
                    {...register('published', { setValueAs: (v) => v === 'true' || v === true })}
                    defaultValue={lesson?.published ? 'true' : 'false'}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-bold"
                  >
                    <option value="true">🟢  Live — visible to students</option>
                    <option value="false">🟡  Draft — hidden from students</option>
                  </select>
                </div>

                {/* 5. Video display title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Video display title</label>
                  <input
                    {...register('videoTitle')}
                    placeholder="The title shown on the video player (defaults to Lesson name if empty)"
                    className="w-full h-12 px-4 rounded-xl border border-border bg-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                  />
                </div>

                {/* 6. Video source toggle + upload/URL */}
                <div className="space-y-3">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
                    Video source
                  </label>
                  {/* Segmented toggle */}
                  <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit">
                    <button
                      type="button"
                      onClick={() => setVideoSource('bunny')}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-bold transition-all ${
                        videoSource === 'bunny'
                          ? 'bg-white text-foreground shadow-sm border border-border'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <CloudUpload className="w-4 h-4" /> Bunny Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoSource('youtube')}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-bold transition-all ${
                        videoSource === 'youtube'
                          ? 'bg-white text-foreground shadow-sm border border-border'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Video className="w-4 h-4" /> YouTube Embed
                    </button>
                  </div>

                  {videoSource === 'bunny' ? (
                    <BunnyUploader
                      lessonId={savedLessonId}
                      moduleId={moduleId}
                      lessonTitle={watchedTitle || lesson?.title || 'Lesson'}
                      existingBunnyVideoId={bunnyVideoId}
                      onFileStaged={(f) => setStagedVideoFile(f)}
                      getToken={getToken}
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        {...register('youtubeUrl')}
                        placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                        className="w-full h-12 px-4 rounded-xl border border-border bg-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-mono"
                      />
                      <p className="text-xs text-muted-foreground font-mono">
                        Paste any YouTube share link. The video will be embedded directly in the lesson player.
                      </p>
                    </div>
                  )}
                </div>

                {/* 6b. Free preview toggle */}
                <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-secondary/30">
                  <input
                    type="checkbox"
                    id="lessonIsFree"
                    {...register('isFree')}
                    className="w-4 h-4 accent-green-600 rounded"
                  />
                  <label htmlFor="lessonIsFree" className="flex-1 cursor-pointer">
                    <div className="text-sm font-bold text-foreground">🎁 Free Preview</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      Students can watch this lesson without purchasing the module — great for sample content.
                    </div>
                  </label>
                </div>

                {/* 7. Lesson description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Lesson description / notes</label>
                  <textarea
                    {...register('summary')}
                    rows={4}
                    placeholder="What should the student understand after this video?"
                    className="w-full p-4 rounded-xl border border-border bg-white focus:ring-2 focus:ring-primary outline-none transition-all resize-none text-sm"
                  />
                </div>

                {/* Professional workflow notice */}
                <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <span className="font-bold">Professional workflow —</span> Save as Draft while preparing. Upload the video file, then switch Status to Live when ready. Only Live lessons appear in the student playlist.
                  </p>
                </div>
              </div>
            )}

            {/* ── TAB 2: Q-bank ── */}
            {activeTab === 'qbank' && (
              <div className="p-7 space-y-4">
                {/* Q-bank header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-foreground">Lesson-specific Q-bank</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Questions added here stay attached to this lesson and can also be grouped under a QFLOW chapter.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <select
                      aria-label="OCR language"
                      value={ocrLanguage}
                      onChange={(event) => setOcrLanguage(event.target.value as ParseQbankPdfBodyOcrLanguage)}
                      disabled={qbankLoading || qbankLoadError || importingPdf}
                      className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                    >
                      <option value="eng+fra">English + French</option>
                      <option value="eng">English</option>
                      <option value="fra">French</option>
                      <option value="ara">Arabic</option>
                      <option value="eng+ara">English + Arabic</option>
                      <option value="eng+fra+ara">English + French + Arabic</option>
                    </select>
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(event) => { void handlePdfFile(event.target.files?.[0]); }}
                    />
                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={qbankLoading || qbankLoadError || importingPdf}
                      className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-white px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {importingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      {importingPdf ? 'Reading PDF…' : 'Import PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={addQ}
                      disabled={qbankLoading || qbankLoadError}
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" /> Add Q
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  PDF text is extracted locally; scanned pages use Tesseract OCR on this server. No AI-credit service is used.
                  The PDF is temporary. New questions are appended to this lesson, then you can edit wording, options, answers,
                  numbering, explanations, and image links before saving.
                </div>

                {qbankLoading && (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading the existing questions before enabling edits…
                  </div>
                )}
                {qbankLoadError && (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-800">
                      Existing questions could not be loaded. Importing and saving are paused to protect the current Q-bank.
                    </p>
                    <button
                      type="button"
                      onClick={() => setQuestionLoadAttempt((attempt) => attempt + 1)}
                      className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                    >
                      Retry loading
                    </button>
                  </div>
                )}

                <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">QFLOW chapter link (optional)</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {qflowChapterIdValue ? 'This Q-bank is grouped under another chapter.' : 'This lesson currently uses its own QFLOW chapter.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQflowLinkPicker((show) => !show)}
                      className="rounded-xl border border-primary/25 bg-white px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/5"
                    >
                      {qflowChapterIdValue ? 'Change / unlink chapter' : 'Link to a module and chapter'}
                    </button>
                  </div>
                  {(showQflowLinkPicker || qflowChapterIdValue) && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <select
                        aria-label="Select QFLOW destination module"
                        value={destinationModuleId}
                        onChange={(event) => {
                          setLinkModuleId(event.target.value);
                          setValue('qflowChapterId', '', { shouldDirty: true });
                        }}
                        className="h-12 w-full rounded-xl border border-border bg-white px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Choose a module</option>
                        {destinationModules.map((destinationModule) => (
                          <option key={destinationModule.id} value={destinationModule.id}>{destinationModule.title}</option>
                        ))}
                      </select>
                      <select
                        id="qflow-chapter-link"
                        aria-label="Select QFLOW destination chapter"
                        {...register('qflowChapterId')}
                        disabled={!destinationModuleId}
                        className="h-12 w-full rounded-xl border border-border bg-white px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">Keep this lesson as its own chapter</option>
                        {chapterChoices
                          .filter((chapter) => chapter.moduleId === destinationModuleId)
                          .map((chapter) => (
                            <option key={chapter.id} value={chapter.id}>
                              {chapter.title} · {chapter.qflowChapterCode || chapter.id}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Linked questions appear in both this lesson’s Q-bank and the destination QFLOW chapter. The video stays in this module. Save the lesson to apply or remove the link.
                  </p>
                </div>

                {/* Empty state */}
                {qbank.length === 0 && !qbankLoading && !qbankLoadError && (
                  <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center space-y-3">
                    <HelpCircle className="w-10 h-10 text-muted-foreground opacity-30 mx-auto" />
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                      No questions yet. Click <strong>Add Q</strong> to create a five-option question, mark the correct answer, add an explanation, and optionally attach an image.
                    </p>
                  </div>
                )}

                {/* Question list */}
                <div className="space-y-3">
                  {qbank.map((q, i) => (
                    <QuestionItem
                      key={q.localId}
                      q={q}
                      index={i}
                      total={qbank.length}
                      onChange={(updated) => updateQ(q.localId, updated)}
                      onRemove={() => removeQ(q.localId)}
                      onDuplicate={() => duplicateQ(q.localId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-7 py-5 border-t border-border bg-white flex items-center justify-between gap-3">
          {/* Tab quick-toggle */}
          <button
            type="button"
            onClick={() => setActiveTab((t) => t === 'video' ? 'qbank' : 'video')}
            className="text-sm font-bold text-primary hover:underline hidden sm:block"
          >
            {activeTab === 'video' ? '→ Go to Q-bank' : '← Go to Video details'}
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              form="lesson-save-form"
              type="submit"
              disabled={saving || qbankLoading || qbankLoadError}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-bold rounded-xl transition-colors shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : qbankLoading ? 'Loading questions…' : qbankLoadError ? 'Q-bank load failed' : (isEditing ? 'Save changes' : 'Create lesson')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function suggestChapterCode(moduleId: string, title: string) {
  const normalized = `${moduleId}-${title}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return normalized || 'QFLOW-CHAPTER';
}
