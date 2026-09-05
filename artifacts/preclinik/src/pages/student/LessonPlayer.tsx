import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { useGetModule, useGetLesson, useListLessons, getExtraHeaders } from '@workspace/api-client-react';
import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { PlayCircle, CheckCircle, LayoutList, ChevronRight, FileText, Lock, Loader2 } from 'lucide-react';
import { usePostHog } from '@/lib/posthog';
import { trackEvent } from '@/lib/googleAnalytics';

/** Fetches a signed Bunny embed URL for a lesson the user owns. */
function useLessonPlayUrl(moduleId: string, lessonId: string, enabled: boolean) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['/api/modules', moduleId, 'lessons', lessonId, 'play-url'],
    enabled,
    // URLs are signed with 1-hour expiry — refetch 10 min before they expire
    staleTime: 50 * 60 * 1000,
    queryFn: async (): Promise<{ embedUrl: string; videoId: string } | null> => {
      const token = await getToken();
      const res = await fetch(`/api/modules/${moduleId}/lessons/${lessonId}/play-url`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...getExtraHeaders(),
        },
      });
      if (res.status === 404) return null; // no video uploaded yet
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });
}

/** Bunny Stream embedded player iframe. */
function BunnyPlayer({ embedUrl }: { embedUrl: string }) {
  return (
    <iframe
      src={embedUrl}
      className="w-full h-full absolute inset-0"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      style={{ border: 'none' }}
      title="Lesson video"
    />
  );
}

/** Convert any YouTube share/watch URL to an embed URL. Returns null if invalid. */
function toYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1).split('?')[0];
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.replace('/embed/', '').split('?')[0];
      } else {
        videoId = u.searchParams.get('v');
      }
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : null;
  } catch {
    return null;
  }
}

/** YouTube embedded player iframe. */
function YouTubePlayer({ embedUrl }: { embedUrl: string }) {
  return (
    <iframe
      src={embedUrl}
      className="w-full h-full absolute inset-0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      style={{ border: 'none' }}
      title="Lesson video"
    />
  );
}

export default function LessonPlayer() {
  const { moduleId, lessonId } = useParams<{ moduleId: string, lessonId: string }>();
  const { isSignedIn } = useAuth();
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'Video content' | 'Q-bank'>('Video content');

  const { capture } = usePostHog();
  const videoRef = useRef<HTMLIFrameElement>(null);
  const lastVideoEventRef = useRef<string | null>(null);

  const { data: module } = useGetModule(moduleId, { query: { enabled: !!moduleId } });
  const { data: lesson, isLoading } = useGetLesson(moduleId, lessonId, { query: { enabled: !!moduleId && !!lessonId } });
  const { data: lessons } = useListLessons(moduleId, { query: { enabled: !!moduleId } });

  useEffect(() => {
    if (!lesson || !module) return;

    trackEvent('lesson_viewed', {
      lesson_id: lesson.id,
      module_id: module.id,
      module_category: module.category,
    });
  }, [lesson, module]);

  const hasYoutube = !!(lesson as any)?.youtubeUrl;
  const hasBunny = !!(lesson as any)?.bunnyVideoId;
  const hasVideo = hasBunny || hasYoutube;

  // Only fetch the Bunny signed URL when there's actually a Bunny video (not YouTube)
  const { data: playData, isLoading: playLoading, error: playError } = useLessonPlayUrl(
    moduleId,
    lessonId,
    !!moduleId && !!lessonId && !!isSignedIn && hasBunny,
  );

  // ── Video event tracking via postMessage (Bunny Stream) ──
  useEffect(() => {
    if (!playData || !lesson) return;

    const onMessage = (e: MessageEvent) => {
      // Bunny Stream iframe sends { event: 'player-play', properties: { ... } }
      const data = e.data;
      if (!data || typeof data !== 'object') return;

      // Bunny Stream events
      if (data.event === 'player-play') {
        const wasPaused = lastVideoEventRef.current === 'player-pause';
        capture(wasPaused ? 'video_resumed' : 'video_started', {
          videoId: lesson.id,
          moduleId,
          lessonTitle: lesson.title,
        });
        if (!wasPaused) {
          trackEvent('lesson_started', {
            lesson_id: lesson.id,
            module_id: moduleId,
            content_type: 'video',
          });
        }
        lastVideoEventRef.current = 'player-play';
      } else if (data.event === 'player-pause') {
        capture('video_paused', {
          videoId: lesson.id,
          moduleId,
          lessonTitle: lesson.title,
        });
        lastVideoEventRef.current = 'player-pause';
      } else if (data.event === 'player-ended') {
        capture('video_completed', {
          videoId: lesson.id,
          moduleId,
          lessonTitle: lesson.title,
        });
        if (lastVideoEventRef.current !== 'player-ended') {
          trackEvent('lesson_completed', {
            lesson_id: lesson.id,
            module_id: moduleId,
            content_type: 'video',
          });
        }
        lastVideoEventRef.current = 'player-ended';
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [playData, lesson, moduleId, capture]);

  if (isLoading || !lesson || !module) {
    return <div className="animate-pulse h-[70vh] bg-white rounded-[22px] border border-border w-full max-w-6xl mx-auto mt-8"></div>;
  }

  const currentIndex = lessons?.findIndex(l => l.id === lesson.id) ?? 0;

  // ── Video area ──
  let videoArea: React.ReactNode;

  if (hasYoutube) {
    // YouTube embed — no signed URL needed
    const youtubeUrl = (lesson as any).youtubeUrl as string;
    const embedUrl = toYoutubeEmbedUrl(youtubeUrl);
    if (embedUrl) {
      videoArea = (
        <div className="w-full aspect-video rounded-[22px] overflow-hidden relative shadow-2xl border border-[#3a3330]">
          <YouTubePlayer embedUrl={embedUrl} />
        </div>
      );
    } else {
      videoArea = (
        <div className="w-full aspect-video bg-gradient-to-br from-[#241e1b] to-[#120f0e] rounded-[22px] overflow-hidden relative shadow-2xl border border-[#3a3330] flex flex-col items-center justify-center text-center p-8">
          <PlayCircle className="w-20 h-20 text-white/20 mb-4" />
          <h3 className="text-white font-serif text-xl font-bold mb-2">{lesson.videoTitle || lesson.title}</h3>
          <span className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-white/50 text-xs font-mono border border-white/10">
            Invalid YouTube URL
          </span>
        </div>
      );
    }
  } else if (!hasBunny) {
    // No video uploaded yet
    videoArea = (
      <div className="w-full aspect-video bg-gradient-to-br from-[#241e1b] to-[#120f0e] rounded-[22px] overflow-hidden relative shadow-2xl border border-[#3a3330] flex flex-col items-center justify-center text-center p-8">
        <PlayCircle className="w-20 h-20 text-white/20 mb-4" />
        <h3 className="text-white font-serif text-xl font-bold mb-2">{lesson.videoTitle || lesson.title}</h3>
        <span className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-white/50 text-xs font-mono border border-white/10">
          Video not yet uploaded
        </span>
      </div>
    );
  } else if (playLoading) {
    // Fetching signed URL
    videoArea = (
      <div className="w-full aspect-video bg-gradient-to-br from-[#241e1b] to-[#120f0e] rounded-[22px] overflow-hidden relative shadow-2xl border border-[#3a3330] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white/40 animate-spin" />
      </div>
    );
  } else if (playError || !playData) {
    // 403 = not owned, 410 = access expired, other = network error
    const is403 = playError instanceof Error && playError.message === '403';
    const is410 = playError instanceof Error && playError.message === '410';
    videoArea = (
      <div className="w-full aspect-video bg-gradient-to-br from-[#241e1b] to-[#120f0e] rounded-[22px] overflow-hidden relative shadow-2xl border border-[#3a3330] flex flex-col items-center justify-center text-center p-8">
        <Lock className="w-14 h-14 text-white/20 mb-4" />
        <h3 className="text-white font-serif text-xl font-bold mb-2">
          {is410 ? 'Access expired' : is403 ? 'Module not owned' : 'Video unavailable'}
        </h3>
        <p className="text-white/50 text-sm font-mono max-w-xs mb-4">
          {is410
            ? 'Your timed access to this module has expired.'
            : is403
            ? 'Purchase this module to unlock all lessons and videos.'
            : 'There was a problem loading this video. Try refreshing the page.'}
        </p>
        {is410 && (
          <Link
            href={`/modules/${moduleId}`}
            className="bg-primary hover:bg-primary/90 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            Renew Access →
          </Link>
        )}
      </div>
    );
  } else {
    // Have a valid Bunny signed embed URL
    videoArea = (
      <div className="w-full aspect-video rounded-[22px] overflow-hidden relative shadow-2xl border border-[#3a3330]">
        <BunnyPlayer embedUrl={playData.embedUrl} />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-500 w-full relative">
      <div className="flex items-center gap-2 text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-6 px-2">
        <Link href={`/modules/${module.id}`} className="hover:text-foreground transition-colors">{module.title}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-primary">Lesson {currentIndex + 1} of {lessons?.length}</span>
      </div>

      <div className="flex items-center justify-between mb-6 px-2">
        <h1 className="text-3xl font-serif font-bold text-foreground">{lesson.title}</h1>
        <button 
          onClick={() => setPlaylistOpen(!playlistOpen)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors border ${playlistOpen ? 'bg-primary text-white border-primary' : 'bg-white text-foreground border-border hover:border-primary'}`}
        >
          <LayoutList className="w-4 h-4" />
          {playlistOpen ? 'Hide playlist' : 'Show playlist'}
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start relative">
        <div className="flex-1 w-full space-y-6">
          {videoArea}

          <div className="bg-white rounded-[22px] border border-border shadow-sm overflow-hidden">
            <div className="flex border-b border-border bg-secondary/30 px-4">
              {(['Video content', 'Q-bank'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 font-bold text-sm transition-all border-b-2 ${activeTab === tab ? 'border-primary text-primary bg-white' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div className="p-8">
              {activeTab === 'Video content' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-serif font-bold text-foreground">Lesson Overview</h3>
                  <div className="prose prose-stone max-w-none text-muted-foreground">
                    <p>{lesson.summary || 'No summary provided for this lesson.'}</p>
                  </div>
                </div>
              )}
              {activeTab === 'Q-bank' && (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground opacity-20 mx-auto mb-4" />
                  <h3 className="font-serif text-xl font-bold mb-2">Lesson Quiz</h3>
                  <p className="text-muted-foreground mb-6">Test your knowledge on {lesson.title}</p>
                  <button
                    onClick={() => {
                      capture('q_bank_quiz_started', {
                        lessonId: lesson.id,
                        moduleId,
                        lessonTitle: lesson.title,
                        questionCount: lesson.questionCount || 0,
                      });
                      trackEvent('q_bank_started', {
                        lesson_id: lesson.id,
                        module_id: moduleId,
                        question_count: lesson.questionCount || 0,
                      });
                    }}
                    className="bg-primary text-white font-bold px-6 py-3 rounded-xl shadow-md hover:bg-primary/90 transition-colors"
                  >
                    Start Quiz ({lesson.questionCount || 0} Questions)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {playlistOpen && (
          <div className="w-full xl:w-[400px] shrink-0 bg-white rounded-[22px] border border-border shadow-sm overflow-hidden xl:sticky xl:top-[100px] max-h-[calc(100vh-120px)] flex flex-col animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="p-5 border-b border-border bg-secondary/30 flex items-center justify-between">
              <h3 className="font-serif font-bold text-lg">Playlist</h3>
              <span className="text-xs font-mono font-bold bg-white px-2 py-1 rounded-md text-muted-foreground border border-border">
                {lessons?.length} items
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {lessons?.map((l, idx) => {
                const isActive = l.id === lesson.id;
                return (
                  <Link 
                    key={l.id} 
                    href={`/modules/${module.id}/lessons/${l.id}`}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-all ${isActive ? 'bg-primary/5 border border-primary/20' : 'hover:bg-secondary border border-transparent'}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-mono font-bold ${isActive ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                      {idx + 1}
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>{l.title}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-1 flex items-center gap-2">
                        {l.duration}
                        {(l as any).bunnyVideoId && <span className="text-green-600">● Video ready</span>}
                        {(l as any).youtubeUrl && <span className="text-red-500">● YouTube</span>}
                        {(l as any).isFree && <span className="text-green-700 font-bold">🎁 Free</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
