import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useGetModule, useListLessons, useListPurchased, useAddToCart, useGetCart, getGetCartQueryKey, getListPurchasedQueryKey, getExtraHeaders } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { toast } from 'sonner';
import { PlayCircle, CheckCircle, Lock, BookOpen, Clock, Users, Star, ShoppingCart, Check, Zap, Upload, MessageSquare, ImageIcon } from 'lucide-react';
import { usePendingModules } from '@/hooks/usePendingModules';
import { useRejectedModules } from '@/hooks/useRejectedModules';
import { NotifyAgain } from '@/components/modules/NotifyAgain';
import { usePostHog } from '@/lib/posthog';
import { trackEvent } from '@/lib/googleAnalytics';

export default function ModuleDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'Videos' | 'Description' | 'Q-bank'>('Videos');
  
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const { data: module, isLoading: moduleLoading } = useGetModule(id, { query: { enabled: !!id } });
  const { data: lessons } = useListLessons(id, { query: { enabled: !!id } });
  const { data: purchasedList } = useListPurchased();
  const { data: cart } = useGetCart();
  const { data: pendingSessions } = usePendingModules();
  const { data: rejectedModules } = useRejectedModules();
  const addToCart = useAddToCart();

  const { capture } = usePostHog();

  // ── Track module viewed ──
  useEffect(() => {
    if (module) {
      capture('module_viewed', {
        moduleId: module.id,
        title: module.title,
        category: module.category,
        isFree: module.isFree,
      });
      trackEvent('view_item', {
        item_id: module.id,
        item_category: module.category,
        is_free: module.isFree,
      });
    }
  }, [module]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Contact support form state ──
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [supportPreview, setSupportPreview] = useState<string | null>(null);
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const supportFileRef = useRef<HTMLInputElement>(null);

  // ── Active dispute — tracks a just-submitted dispute locally ──
  const [activeDispute, setActiveDispute] = useState<{
    disputeId: string;
    createdAt: string;
    /** Tracked locally after first remind */
    lastRemindedAt: string | null;
  } | null>(null);

  const inCart = cart?.items.some(i => i.moduleId === id) ?? false;
  const isPurchased = purchasedList?.includes(id);
  // useMemo must stay before any early return (Rules of Hooks)
  const pendingSession = useMemo(
    () => pendingSessions?.find(s => s.moduleIds.includes(id ?? '')) ?? null,
    [pendingSessions, id],
  );
  const isPending = !isPurchased && pendingSession !== null;
  const isRejected = !isPurchased && !isPending && (rejectedModules?.includes(id ?? '') ?? false);

  const handleSupportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSupportFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onloadend = () => setSupportPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setSupportPreview(null);
    }
  };

  const handleSubmitSupport = async () => {
    if (!supportMessage.trim()) return;
    setIsSubmittingSupport(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('moduleId', id!);
      formData.append('message', supportMessage.trim());
      if (supportFile) {
        formData.append('receipt', supportFile);
      }

      const res = await fetch('/api/purchases/disputes/submit', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...getExtraHeaders(),
        },
        body: formData,
      });

      const result = (await res.json().catch(() => ({}))) as Record<string, string>;
      if (!res.ok) {
        throw new Error(result.error ?? `Server error (${res.status})`);
      }
      setActiveDispute({ disputeId: result.disputeId, createdAt: result.createdAt, lastRemindedAt: null });
      toast.success('Support request sent — we will review it shortly.');
      setShowSupportForm(false);
      setSupportMessage('');
      setSupportFile(null);
      setSupportPreview(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(msg);
      console.error('[Dispute] submit error:', err);
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  const handleFreeEnroll = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/modules/${module!.id}/enroll-free`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...getExtraHeaders(),
        },
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: getListPurchasedQueryKey() });
      toast.success('Access granted — enjoy the module!');
    } catch {
      toast.error('Could not unlock module. Please try again.');
    }
  };

  const handleAddToCart = () => {
    addToCart.mutate(
      { moduleId: module!.id },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetCartQueryKey(), data);
          capture('added_to_cart', {
            moduleId: module!.id,
            title: module!.title,
            category: module!.category,
            price: module!.price,
          });
          trackEvent('add_to_cart', {
            item_id: module!.id,
            item_category: module!.category,
            value: lowestPrice,
            currency: 'DZD',
          });
          toast.success(`${module!.title} added to cart — choose your access period at checkout`);
        },
        onError: () => toast.error('Could not add to cart. Please try again.'),
      },
    );
  };

  // Compute available tiers from module data
  const tierOptions = (() => {
    if (!module) return [];
    const candidates: { key: string; label: string; price: number | null | undefined }[] = [
      { key: '3month', label: '3-Month Access', price: module.price3Month },
      { key: '1year', label: '1-Year Access', price: module.price1Year },
      { key: 'lifetime', label: 'Lifetime Access', price: module.priceLifetime },
    ];
    const filtered = candidates.filter(
      (t): t is { key: string; label: string; price: number } =>
        typeof t.price === 'number' && t.price > 0,
    );
    // Fallback to legacy flat price for backward compat
    if (filtered.length === 0 && module.price > 0) {
      filtered.push({ key: 'lifetime', label: 'Lifetime Access', price: module.price });
    }
    return filtered;
  })();
  const lowestPrice = tierOptions[0]?.price ?? module?.price ?? 0;

  if (moduleLoading || !module) {
    return <div className="animate-pulse h-[60vh] bg-white rounded-[22px] border border-border"></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      <div 
        className="rounded-[22px] overflow-hidden text-white relative flex flex-col md:flex-row shadow-lg"
        style={{ background: module.gradient || 'linear-gradient(135deg, var(--blue), var(--orange))' }}
      >
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
        
        <div className="p-8 md:p-12 z-10 flex-1 flex flex-col justify-center">
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-widest font-mono">
              Year {module.year}
            </span>
            <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-widest font-mono">
              {module.category}
            </span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 leading-tight">{module.title}</h1>
          <p className="text-lg text-white/90 max-w-2xl mb-8 leading-relaxed">
            {module.summary}
          </p>
          
          <div className="flex flex-wrap items-center gap-6 text-sm font-mono text-white/80">
            <div className="flex items-center gap-2"><Clock className="w-4 h-4"/> {module.duration}</div>
            <div className="flex items-center gap-2"><Users className="w-4 h-4"/> {module.students} Students</div>
            <div className="flex items-center gap-2"><Star className="w-4 h-4"/> {module.rating.toFixed(1)} Rating</div>
            <div className="flex items-center gap-2"><BookOpen className="w-4 h-4"/> {module.provider}</div>
          </div>
        </div>

        {/* Enroll panel — hidden once purchased */}
        {!isPurchased && (
          <div className="bg-white p-8 md:w-80 flex flex-col justify-center shrink-0 border-l border-border relative z-10">
            {isPending ? (
              /* ── Pending purchase state ── */
              <div className="flex flex-col items-center text-center gap-4">
                <div className="text-3xl">⏳</div>
                <div>
                  <div className="text-sm font-bold text-amber-700 font-mono uppercase tracking-widest mb-1">
                    Pending Review
                  </div>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                    Your payment receipt has been submitted. The admin will approve your access shortly.
                  </p>
                </div>
                <NotifyAgain
                  sessionId={pendingSession!.sessionId}
                  lastRemindedAt={pendingSession!.lastRemindedAt}
                  createdAt={pendingSession!.createdAt}
                  variant="full"
                />
              </div>
            ) : activeDispute ? (
              /* ── Pending dispute state (same visual as pending purchase) ── */
              <div className="flex flex-col items-center text-center gap-4">
                <div className="text-3xl">⏳</div>
                <div>
                  <div className="text-sm font-bold text-amber-700 font-mono uppercase tracking-widest mb-1">
                    Pending Review
                  </div>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                    Your support request has been submitted. The admin will review and respond shortly.
                  </p>
                </div>
                <NotifyAgain
                  sessionId={activeDispute.disputeId}
                  lastRemindedAt={activeDispute.lastRemindedAt}
                  createdAt={activeDispute.createdAt}
                  remindEndpoint={`/api/purchases/disputes/remind/${activeDispute.disputeId}`}
                  variant="full"
                />
              </div>
            ) : isRejected && !showSupportForm ? (
              /* ── Rejected state — Add to Cart + Contact Support ── */
              <div className="flex flex-col items-center text-center gap-4">
                <div className="text-3xl">❌</div>
                <div>
                  <div className="text-sm font-bold text-red-700 font-mono uppercase tracking-widest mb-1">
                    Payment Could Not Be Verified
                  </div>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                    Your previous payment receipt could not be approved. You can try purchasing again or contact support for help.
                  </p>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={addToCart.isPending || inCart}
                  className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                    inCart
                      ? 'bg-green-600 text-white shadow-green-600/20 cursor-default'
                      : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
                  }`}
                >
                  {inCart ? (
                    <><Check className="w-5 h-5" /> In Cart</>
                  ) : addToCart.isPending ? (
                    'Adding…'
                  ) : (
                    <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
                  )}
                </button>
                <button
                  onClick={() => setShowSupportForm(true)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono underline underline-offset-2"
                >
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                  Contact Support
                </button>
              </div>
            ) : isRejected && showSupportForm ? (
              /* ── Contact Support form ── */
              <div className="flex flex-col text-left gap-4">
                <div>
                  <div className="text-sm font-bold text-red-700 font-mono uppercase tracking-widest mb-1">
                    Contact Support
                  </div>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                    Explain what went wrong and attach a corrected receipt if you have one.
                  </p>
                </div>

                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Tell us what happened..."
                  rows={3}
                  className="w-full text-sm rounded-xl border border-border bg-secondary/30 px-3 py-2.5 font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />

                {/* Optional file upload */}
                <div
                  onClick={() => supportFileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5 min-h-[100px] ${
                    supportPreview ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                  }`}
                >
                  {supportPreview ? (
                    <img src={supportPreview} alt="New receipt" className="max-h-20 w-full object-contain rounded-lg px-2" />
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6 text-muted-foreground opacity-40" />
                      <p className="text-[11px] text-muted-foreground font-mono">Optional: attach a new receipt</p>
                    </>
                  )}
                  <input
                    ref={supportFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSupportFileChange}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowSupportForm(false); setSupportMessage(''); setSupportFile(null); setSupportPreview(null); }}
                    className="flex-1 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono py-3 rounded-xl border border-border"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitSupport}
                    disabled={!supportMessage.trim() || isSubmittingSupport}
                    className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmittingSupport ? (
                      <span className="font-mono text-sm">Sending...</span>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : module.isFree ? (
              /* ── Free module state ── */
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-green-700 font-mono font-bold uppercase tracking-widest mb-1">Free Access</div>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                    This module is completely free. Start watching immediately — no payment required.
                  </p>
                </div>
                <button
                  onClick={handleFreeEnroll}
                  className="w-full font-bold py-4 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-5 h-5" /> Start Learning
                </button>
              </div>
            ) : (
              /* ── Normal enroll panel — tiered pricing ── */
              <>
                <div className="text-center mb-4">
                  <div className="text-xs text-muted-foreground font-mono font-bold uppercase tracking-widest mb-1">Enroll Now</div>
                  {tierOptions.length > 1 ? (
                    <div className="text-sm text-muted-foreground font-mono">
                      from <span className="text-2xl font-serif font-bold text-foreground">{lowestPrice.toLocaleString()}</span> DZD
                    </div>
                  ) : (
                    <div className="text-3xl font-serif font-bold text-foreground">
                      {lowestPrice.toLocaleString()} DZD
                    </div>
                  )}
                </div>

                {/* Tier options */}
                {tierOptions.length > 1 && (
                  <div className="space-y-2 mb-4">
                    {tierOptions.map(tier => (
                      <div key={tier.key} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-secondary/30 text-sm">
                        <span className="font-bold font-mono text-xs uppercase tracking-widest text-foreground">{tier.label}</span>
                        <span className="font-bold font-mono text-primary">{tier.price.toLocaleString()} DZD</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleAddToCart}
                  disabled={addToCart.isPending || inCart}
                  className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg mb-3 flex items-center justify-center gap-2 disabled:opacity-75 ${
                    inCart
                      ? 'bg-green-600 text-white shadow-green-600/20 cursor-default'
                      : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
                  }`}
                >
                  {inCart ? (
                    <><Check className="w-5 h-5" /> In Cart</>
                  ) : addToCart.isPending ? (
                    'Adding…'
                  ) : (
                    <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
                  )}
                </button>
                <p className="text-xs text-muted-foreground text-center font-mono">
                  {tierOptions.length > 1 ? 'Choose your access period at checkout.' : 'Full lifetime access.'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[22px] border border-border shadow-sm overflow-hidden min-h-[500px]">
        <div className="flex border-b border-border bg-secondary/30 px-6">
          {(['Videos', 'Description', 'Q-bank'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 font-bold text-sm transition-all border-b-2 ${activeTab === tab ? 'border-primary text-primary bg-white' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-8 md:p-10">
          {activeTab === 'Description' && (
            <div className="max-w-[640px] space-y-10">
              <section>
                <h2 className="text-2xl font-serif font-bold mb-4">About this module</h2>
                <p className="text-muted-foreground text-lg leading-relaxed">{module.summary} This comprehensive module breaks down complex physiological interactions into understandable, retainable concepts designed specifically for medical students preparing for board exams.</p>
              </section>
              
              <section>
                <h2 className="text-2xl font-serif font-bold mb-6">What you will learn</h2>
                <ul className="space-y-4">
                  {module.outcomes?.map((outcome, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-foreground">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      <span className="font-bold text-lg">{outcome}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {activeTab === 'Videos' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h2 className="text-xl font-serif font-bold">Lessons ({module.lessonCount || (lessons?.length ?? 0)})</h2>
                {isPurchased && lessons && lessons.length > 0 && (
                  <Link href={`/modules/${module.id}/lessons/${lessons[0].id}`} className="bg-secondary hover:bg-secondary/80 text-foreground font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                    Watch full playlist
                  </Link>
                )}
              </div>

              <div className="space-y-3">
                {lessons?.length ? lessons.map((lesson) => (
                  <div key={lesson.id} className="flex items-center justify-between p-4 rounded-2xl border border-border bg-white hover:bg-secondary/30 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                        <PlayCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">{lesson.title}</h4>
                        <div className="text-xs text-muted-foreground font-mono mt-1">
                          {lesson.type} · {lesson.duration} · {lesson.questionCount || 0} Questions
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      {isPurchased || lesson.isFree ? (
                        <Link 
                          href={`/modules/${module.id}/lessons/${lesson.id}`}
                          className={`px-5 py-2 rounded-xl font-bold text-sm transition-all inline-block ${
                            lesson.isFree && !isPurchased
                              ? 'bg-green-100 hover:bg-green-600 text-green-700 hover:text-white'
                              : 'bg-primary/10 hover:bg-primary text-primary hover:text-white'
                          }`}
                        >
                          {lesson.isFree && !isPurchased ? '🎁 Preview' : 'Watch'}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary text-muted-foreground">
                          <Lock className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 text-muted-foreground font-mono">
                    Lessons are currently being prepared. Check back soon.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Q-bank' && (
            <div className="text-center py-16">
              <Lock className="w-12 h-12 text-muted-foreground opacity-20 mx-auto mb-4" />
              <h3 className="font-serif text-2xl font-bold text-foreground mb-2">Module Q-bank</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">Access hundreds of board-style questions specific to this module. Available only to enrolled students.</p>
              {!isPurchased && !isPending && (
                <button
                  onClick={handleAddToCart}
                  disabled={addToCart.isPending || inCart}
                  className={`font-bold px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 mx-auto disabled:opacity-75 transition-all ${
                    inCart
                      ? 'bg-green-600 text-white shadow-green-600/20 cursor-default'
                      : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'
                  }`}
                >
                  {inCart ? <><Check className="w-4 h-4" /> In Cart</> : 'Enroll to unlock'}
                </button>
              )}
              {isPending && (
                <p className="text-sm text-amber-700 font-mono font-semibold">⏳ Awaiting admin approval</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
