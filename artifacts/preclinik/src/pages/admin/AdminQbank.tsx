import { useEffect, useMemo, useState } from "react";
import { BookOpen, CircleHelp, ExternalLink, Film, Layers3, Plus, RefreshCw, Search } from "lucide-react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  getListLessonsQueryKey,
  getListQflowChaptersQueryKey,
  listLessons,
  useListModules,
  useListQflowChapters,
  type Lesson,
} from "@workspace/api-client-react";
import { LessonEditor } from "@/components/lessons/LessonEditor";

export default function AdminQbank() {
  const queryClient = useQueryClient();
  const { data: modules, isLoading: modulesLoading, isError: modulesError, refetch: refetchModules } = useListModules();
  const [moduleId, setModuleId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [editor, setEditor] = useState<{
    moduleId: string;
    lesson: Lesson | null;
    tab: "video" | "qbank";
    linkPicker?: boolean;
    linkModuleId?: string;
  } | null>(null);
  const [lessonSearch, setLessonSearch] = useState("");

  useEffect(() => {
    if (!moduleId && modules?.length) setModuleId(modules[0].id);
  }, [moduleId, modules]);

  const { data: chapters, isLoading: chaptersLoading, isError: chaptersError, refetch: refetchChapters } = useListQflowChapters(moduleId, {
    query: { enabled: !!moduleId, queryKey: getListQflowChaptersQueryKey(moduleId) },
  });
  const lessonQueries = useQueries({
    queries: (modules ?? []).map((module) => ({
      queryKey: getListLessonsQueryKey(module.id),
      queryFn: () => listLessons(module.id),
      enabled: Boolean(module.id),
    })),
  });
  const allLessons = lessonQueries.flatMap((query) => query.data ?? []);
  const lessonsLoading = lessonQueries.some((query) => query.isLoading);
  const lessonsError = lessonQueries.some((query) => query.isError);
  const moduleTitleById = useMemo(() => new Map((modules ?? []).map((module) => [module.id, module.title])), [modules]);

  useEffect(() => {
    if (!chapters?.length) {
      setChapterId("");
      return;
    }
    if (!chapters.some((chapter) => chapter.id === chapterId)) setChapterId(chapters[0].id);
  }, [chapterId, chapters]);

  const selectedChapter = chapters?.find((chapter) => chapter.id === chapterId);
  const linkedLessons = useMemo(() => {
    if (!selectedChapter) return [];
    const fromChapter = selectedChapter.linkedLessons ?? [];
    const fromLoadedLessons = allLessons
      .filter((lesson) => lesson.qflowChapterId === selectedChapter.id)
      .map((lesson) => ({
        id: lesson.id,
        moduleId: lesson.moduleId,
        title: lesson.title,
        type: lesson.type,
        duration: lesson.duration,
        published: lesson.published,
      }));
    return [...new Map([...fromChapter, ...fromLoadedLessons].map((lesson) => [lesson.id, lesson])).values()];
  }, [allLessons, selectedChapter]);

  const videos = allLessons.filter((lesson) => lesson.type === "Video");
  const visibleVideos = videos.filter((lesson) => {
    const needle = lessonSearch.trim().toLocaleLowerCase();
    return !needle
      || lesson.title.toLocaleLowerCase().includes(needle)
      || moduleTitleById.get(lesson.moduleId)?.toLocaleLowerCase().includes(needle);
  });

  const closeEditor = () => {
    setEditor(null);
    for (const module of modules ?? []) {
      void queryClient.invalidateQueries({ queryKey: getListQflowChaptersQueryKey(module.id) });
      void queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey(module.id) });
    }
  };

  if (modulesLoading) {
    return <div className="space-y-6" aria-label="Loading QFLOW bank"><div className="h-16 animate-pulse rounded-2xl bg-[#eee9e0]" /><div className="h-64 animate-pulse rounded-2xl bg-[#eee9e0]" /><div className="h-48 animate-pulse rounded-2xl bg-[#eee9e0]" /></div>;
  }

  if (modulesError) {
    return <div role="alert" className="rounded-2xl border border-[#e3ddd2] bg-[#fbfaf7] p-10 text-center"><CircleHelp className="mx-auto h-8 w-8 text-[#8b1a2f]" /><h1 className="mt-3 font-serif text-2xl font-semibold">Modules did not load</h1><p className="mt-2 text-sm text-[#716b62]">QFLOW management needs the module list to continue.</p><button type="button" onClick={() => void refetchModules()} className="mt-5 rounded-lg bg-[#8b1a2f] px-4 py-2 text-sm font-bold text-white">Retry</button></div>;
  }

  if (!modules?.length) {
    return <div className="rounded-2xl border border-dashed border-[#d8d0c4] bg-[#fbfaf7] p-12 text-center"><Layers3 className="mx-auto h-8 w-8 text-[#8c857b]" /><h1 className="mt-3 font-serif text-2xl font-semibold">Create a module first</h1><p className="mt-2 text-sm text-[#716b62]">QFLOW chapters are lessons in an existing module. There are no modules to manage yet.</p></div>;
  }

  return (
    <div className="space-y-6 text-[#252522]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8b1a2f]">Content administration</p><h1 className="mt-2 font-serif text-3xl font-semibold">QFLOW question bank</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#716b62]">Manage chapters as Lesson records. Review question totals and teaching links, or open the existing lesson editor.</p></div>
        <button type="button" disabled={!moduleId} onClick={() => setEditor({ moduleId, lesson: null, tab: "qbank" })} data-testid="button-create-qflow-chapter" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#8b1a2f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#741426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8b1a2f] disabled:opacity-50"><Plus className="h-4 w-4" /> Create chapter</button>
      </header>

      <section className="grid gap-4 rounded-2xl border border-[#e3ddd2] bg-[#fbfaf7] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-5">
        <label className="block"><span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#716b62]">Module</span><select value={moduleId} onChange={(event) => { setModuleId(event.target.value); setChapterId(""); }} data-testid="select-qbank-module" className="h-11 w-full rounded-lg border border-[#ded8cd] bg-white px-3 text-sm font-semibold outline-none focus:border-[#8b1a2f] focus:ring-2 focus:ring-[#8b1a2f]/15">{modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label>
        <label className="block"><span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#716b62]">Chapter</span><select value={chapterId} disabled={!chapters?.length || chaptersLoading || chaptersError} onChange={(event) => setChapterId(event.target.value)} data-testid="select-qbank-chapter" className="h-11 w-full rounded-lg border border-[#ded8cd] bg-white px-3 text-sm font-semibold outline-none focus:border-[#8b1a2f] focus:ring-2 focus:ring-[#8b1a2f]/15 disabled:opacity-60"><option value="">{chaptersLoading ? "Loading chapters…" : chapters?.length ? "Select a chapter" : "No chapters in this module"}</option>{chapters?.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.qflowChapterCode ? `${chapter.qflowChapterCode} · ` : ""}{chapter.title}</option>)}</select></label>
      </section>

      {chaptersError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2c9c5] bg-[#fbf4f2] px-4 py-3 text-sm text-[#71434a]"><span>Could not load QFLOW chapters for this module.</span><button type="button" onClick={() => void refetchChapters()} className="inline-flex items-center gap-2 font-bold text-[#8b1a2f]"><RefreshCw className="h-3.5 w-3.5" /> Retry</button></div>}

      {chaptersLoading ? (
        <div className="space-y-3" aria-label="Loading chapters"><div className="h-28 animate-pulse rounded-2xl bg-[#eee9e0]" /><div className="h-28 animate-pulse rounded-2xl bg-[#eee9e0]" /></div>
      ) : !chaptersError && !chapters?.length ? (
        <div className="rounded-2xl border border-dashed border-[#d8d0c4] bg-[#fbfaf7] p-10 text-center"><BookOpen className="mx-auto h-8 w-8 text-[#8c857b]" /><h2 className="mt-3 font-serif text-xl font-semibold">No QFLOW chapters yet</h2><p className="mt-2 text-sm text-[#716b62]">Create a chapter to add its Q-bank questions to this module.</p><button type="button" onClick={() => setEditor({ moduleId, lesson: null, tab: "qbank" })} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#8b1a2f] px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Create first chapter</button></div>
      ) : selectedChapter ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
          <section className="overflow-hidden rounded-2xl border border-[#e3ddd2] bg-[#fbfaf7]">
            <div className="border-b border-[#e9e3d9] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#8b1a2f]">{selectedChapter.qflowChapterCode || "QFLOW chapter"}</p><h2 className="mt-2 font-serif text-2xl font-semibold">{selectedChapter.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#716b62]">{selectedChapter.summary || "No chapter summary."}</p></div>
                <span className="rounded-lg border border-[#dfd2c4] bg-[#f5f0e8] px-3 py-2 text-right"><strong className="block font-mono text-lg text-[#8b1a2f]" data-testid={`count-questions-${selectedChapter.id}`}>{selectedChapter.questionCount ?? 0}</strong><span className="font-mono text-[9px] uppercase tracking-wide text-[#777168]">questions</span></span>
              </div>
              <button type="button" onClick={() => setEditor({ moduleId, lesson: selectedChapter, tab: "qbank" })} data-testid={`button-edit-qbank-${selectedChapter.id}`} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#8b1a2f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#741426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8b1a2f]"><BookOpen className="h-4 w-4" /> Open chapter Q-bank</button>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4"><div><h3 className="font-serif text-lg font-semibold">Linked teaching lessons</h3><p className="mt-1 text-xs text-[#777168]">Published video lessons appear to students in this chapter.</p></div><span className="font-mono text-xs text-[#716b62]">{linkedLessons.length} linked</span></div>
              {linkedLessons.length ? <ul className="mt-4 divide-y divide-[#eee8df] rounded-xl border border-[#e9e3d9]">{linkedLessons.map((lesson) => { const fullLesson = allLessons.find((candidate) => candidate.id === lesson.id); return <li key={lesson.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f2e8e5] text-[#8b1a2f]"><Film className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{lesson.title}</p><p className="mt-1 font-mono text-[10px] text-[#777168]">{moduleTitleById.get(lesson.moduleId) ?? lesson.moduleId} · {lesson.duration} · {lesson.published ? "Published" : "Draft"}</p></div></div><button type="button" disabled={!fullLesson} onClick={() => fullLesson && setEditor({ moduleId: fullLesson.moduleId, lesson: fullLesson, tab: "qbank", linkPicker: true, linkModuleId: selectedChapter.moduleId })} className="inline-flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs font-bold text-[#8b1a2f] hover:bg-[#f2e8e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto">Edit links <ExternalLink className="h-3.5 w-3.5" /></button></li>; })}</ul> : <div className="mt-4 rounded-xl border border-dashed border-[#ddd6ca] px-4 py-6 text-center text-sm text-[#777168]">No teaching lessons linked to this chapter.</div>}
            </div>
          </section>

          <section className="rounded-2xl border border-[#e3ddd2] bg-[#fbfaf7] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#8b1a2f]">Linking</p><h3 className="mt-2 font-serif text-xl font-semibold">Connect a video lesson</h3><p className="mt-2 text-sm leading-5 text-[#716b62]">Open a video lesson in the editor to choose its QFLOW chapter.</p></div><Film className="mt-1 h-5 w-5 shrink-0 text-[#8b1a2f]" /></div>
            <label className="relative mt-4 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c857b]" /><input type="search" value={lessonSearch} onChange={(event) => setLessonSearch(event.target.value)} placeholder="Filter video lessons" aria-label="Filter video lessons" className="h-10 w-full rounded-lg border border-[#ded8cd] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#8b1a2f] focus:ring-2 focus:ring-[#8b1a2f]/15" /></label>
            {lessonsError ? <div role="alert" className="mt-4 rounded-lg bg-[#fbf4f2] p-4 text-sm text-[#71434a]"><p>Could not load video lessons for one or more modules.</p><button type="button" onClick={() => { for (const query of lessonQueries) void query.refetch(); }} className="mt-2 font-bold text-[#8b1a2f]">Retry</button></div> : lessonsLoading ? <div aria-label="Loading video lessons" className="mt-4 space-y-2"><div className="h-14 animate-pulse rounded-lg bg-[#eee9e0]" /><div className="h-14 animate-pulse rounded-lg bg-[#eee9e0]" /></div> : visibleVideos.length ? <ul className="mt-3 max-h-[430px] divide-y divide-[#eee8df] overflow-auto">{visibleVideos.map((lesson) => { const linked = lesson.qflowChapterId === selectedChapter.id; return <li key={lesson.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{lesson.title}</p><p className="mt-1 font-mono text-[10px] text-[#777168]">{moduleTitleById.get(lesson.moduleId) ?? lesson.moduleId} · {lesson.published ? "Published" : "Draft"}{lesson.qflowChapterId ? ` · linked to ${lesson.qflowChapterId}` : " · not linked"}</p></div><button type="button" onClick={() => setEditor({ moduleId: lesson.moduleId, lesson, tab: "qbank", linkPicker: true, linkModuleId: selectedChapter.moduleId })} data-testid={`button-link-video-${lesson.id}`} className="shrink-0 rounded-lg border border-[#ded8cd] bg-white px-3 py-2 text-xs font-bold text-[#8b1a2f] hover:border-[#c8b7a7] hover:bg-[#f7f4ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1a2f]">{linked ? "Edit link" : "Link lesson"}</button></li>; })}</ul> : <div className="mt-4 rounded-xl border border-dashed border-[#ddd6ca] px-4 py-7 text-center text-sm text-[#777168]">{videos.length ? "No video lessons match this filter." : "No video lessons in any module yet."}</div>}
          </section>
        </div>
      ) : null}

      {editor && (
        <LessonEditor
          moduleId={editor.moduleId}
          lesson={editor.lesson}
          onClose={closeEditor}
          initialTab={editor.tab}
          initialLinkPickerOpen={editor.linkPicker}
          initialLinkModuleId={editor.linkModuleId ?? moduleId}
        />
      )}
    </div>
  );
}
