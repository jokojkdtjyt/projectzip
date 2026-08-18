import React, { useRef, useState, useMemo } from 'react';
import { X, ShoppingCart, Trash2, Upload, ImageIcon, CheckCircle, ChevronRight } from 'lucide-react';
import { useGetCart, useRemoveFromCart, getGetCartQueryKey, getListPurchasedQueryKey } from '@workspace/api-client-react';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePostHog } from '@/lib/posthog';

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TierKey = '3month' | '1year' | 'lifetime';
type Step = 'cart' | 'tiers' | 'upload' | 'success';

function availableTiers(item: {
  price3Month?: number | null;
  price1Year?: number | null;
  priceLifetime?: number | null;
  price?: number;
}): { key: TierKey; label: string; price: number }[] {
  const candidates: { key: TierKey; label: string; price: number | null | undefined }[] = [
    { key: '3month', label: '3-Month', price: item.price3Month },
    { key: '1year', label: '1-Year', price: item.price1Year },
    { key: 'lifetime', label: 'Lifetime', price: item.priceLifetime },
  ];
  const result = candidates.filter((t): t is { key: TierKey; label: string; price: number } =>
    typeof t.price === 'number' && t.price > 0,
  );
  // If no tier prices configured, fall back to legacy flat price as "Lifetime"
  if (result.length === 0 && item.price && item.price > 0) {
    result.push({ key: 'lifetime', label: 'Lifetime', price: item.price });
  }
  return result;
}

export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const { data: cart } = useGetCart();
  const removeFromCart = useRemoveFromCart();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const { capture } = usePostHog();

  const [step, setStep] = useState<Step>('cart');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tier selections: { [moduleId]: TierKey }
  const [selectedTiers, setSelectedTiers] = useState<Record<string, TierKey>>({});

  const items = cart?.items ?? [];

  // Computed total from selected tiers — must be before early return (hook rule)
  const computedTotal = useMemo(() => {
    let total = 0;
    for (const item of items) {
      const tiers = availableTiers(item as Parameters<typeof availableTiers>[0]);
      const tier = selectedTiers[item.moduleId];
      const match = tiers.find(t => t.key === tier) ?? tiers[0];
      total += match?.price ?? 0;
    }
    return total;
  }, [items, selectedTiers]);

  if (!open) return null;

  // On entering tier step, seed defaults to the cheapest available tier per module
  const handleProceedToTiers = () => {
    const defaults: Record<string, TierKey> = {};
    for (const item of items) {
      const tiers = availableTiers(item as Parameters<typeof availableTiers>[0]);
      defaults[item.moduleId] = tiers[0]?.key ?? 'lifetime';
    }
    setSelectedTiers(defaults);
    setStep('tiers');
  };

  const handleRemove = (moduleId: string) => {
    removeFromCart.mutate({ moduleId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setIsSubmitting(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('receipt', file);
      // Send tier selections as JSON
      formData.append('tiers', JSON.stringify(selectedTiers));

      const res = await fetch('/api/purchases/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Upload failed');
      }

      capture('purchase_completed', {
        totalAmount: computedTotal,
        itemCount: items.length,
        moduleIds: items.map((i) => i.moduleId),
        moduleTitles: items.map((i) => i.title),
      });

      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListPurchasedQueryKey() });
      setStep('success');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong', {
        style: { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)' }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('cart');
    setFile(null);
    setPreview(null);
    setSelectedTiers({});
    onOpenChange(false);
  };

  const stepTitle =
    step === 'tiers' ? 'Choose Access Period'
    : step === 'upload' ? 'Upload Receipt'
    : step === 'success' ? 'Request Submitted'
    : 'Your Cart';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 border-l border-border">

        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-xl font-bold">{stepTitle}</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step: cart ── */}
        {step === 'cart' && (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-mono text-sm">Your cart is empty.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const tiers = availableTiers(item as Parameters<typeof availableTiers>[0]);
                    const lowestPrice = tiers[0]?.price;
                    return (
                      <div key={item.moduleId} className="flex gap-4 p-4 rounded-2xl border border-border bg-white shadow-sm">
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground font-mono mb-1">
                            {item.category}
                          </div>
                          <h4 className="font-bold text-sm text-foreground truncate">{item.title}</h4>
                          <div className="text-xs text-muted-foreground font-mono mt-1">
                            {item.duration}
                          </div>
                          {lowestPrice != null && (
                            <div className="font-bold font-mono mt-2 text-primary text-sm">
                              {tiers.length > 1 ? `from ${lowestPrice.toLocaleString()}` : lowestPrice.toLocaleString()} DZD
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemove(item.moduleId)}
                          className="self-start p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-border bg-secondary/30">
                <p className="text-xs text-muted-foreground font-mono mb-4 leading-relaxed">
                  Next, choose your access period per module, then upload your payment receipt for admin approval.
                </p>
                <button
                  onClick={handleProceedToTiers}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-[10px] shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  Choose Access Period <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Step: tiers ── */}
        {step === 'tiers' && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                Select how long you want access to each module. You can purchase different tiers for different modules.
              </p>

              {items.map((item) => {
                const tiers = availableTiers(item as Parameters<typeof availableTiers>[0]);
                const selected = selectedTiers[item.moduleId] ?? tiers[0]?.key;
                const selectedPrice = tiers.find(t => t.key === selected)?.price ?? 0;

                return (
                  <div key={item.moduleId} className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground font-mono mb-0.5">
                        {item.category}
                      </div>
                      <h4 className="font-bold text-sm text-foreground">{item.title}</h4>
                    </div>

                    {tiers.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-mono italic">No pricing configured for this module.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {tiers.map((tier) => (
                          <button
                            key={tier.key}
                            onClick={() => setSelectedTiers(prev => ({ ...prev, [item.moduleId]: tier.key }))}
                            className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all text-center ${
                              selected === tier.key
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-border hover:border-primary/40 text-foreground'
                            }`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest font-mono mb-1">
                              {tier.label}
                            </span>
                            <span className="font-bold font-mono text-sm">
                              {tier.price.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">DZD</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="text-right text-xs font-mono text-muted-foreground">
                      Subtotal: <span className="font-bold text-foreground">{selectedPrice.toLocaleString()} DZD</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-6 border-t border-border bg-secondary/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                <span className="font-serif text-2xl font-bold">{computedTotal.toLocaleString()} DZD</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                Transfer this amount to our CCP account, then upload your receipt.
              </p>
              <button
                onClick={() => setStep('upload')}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-[10px] shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Payment Receipt
              </button>
              <button
                onClick={() => setStep('cart')}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors font-mono py-2"
              >
                ← Back to cart
              </button>
            </div>
          </>
        )}

        {/* ── Step: upload ── */}
        {step === 'upload' && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                After transferring <span className="font-bold text-foreground">{computedTotal.toLocaleString()} DZD</span> to our CCP account, upload a clear photo of your receipt below.
              </p>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[220px] ${
                  preview ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                }`}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Receipt preview"
                    className="max-h-52 w-full object-contain rounded-xl px-2"
                  />
                ) : (
                  <>
                    <ImageIcon className="w-10 h-10 text-muted-foreground opacity-40" />
                    <div className="text-center px-4">
                      <p className="font-bold text-sm text-foreground">Drop your receipt here</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">or click to browse · JPG, PNG, HEIC</p>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {file && (
                <p className="text-xs text-muted-foreground font-mono text-center">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </p>
              )}

              <p className="text-[11px] text-muted-foreground font-mono text-center leading-relaxed">
                Receipt images are only used for payment verification.{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-bold"
                >
                  Terms & Privacy
                </a>
              </p>
            </div>

            <div className="p-6 border-t border-border bg-secondary/30 flex flex-col gap-3">
              <button
                onClick={handleSubmit}
                disabled={!file || isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-[10px] shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="font-mono text-sm">Submitting...</span>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Submit Receipt
                  </>
                )}
              </button>
              <button
                onClick={() => { setStep('tiers'); setFile(null); setPreview(null); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors font-mono py-2"
              >
                ← Back to tier selection
              </button>
            </div>
          </>
        )}

        {/* ── Step: success ── */}
        {step === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-foreground mb-2">Receipt submitted!</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Your receipt is being reviewed. You'll get access to your modules as soon as an admin approves it — usually within a few hours.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="mt-2 px-6 py-3 rounded-[10px] bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              Got it
            </button>
          </div>
        )}

      </div>
    </>
  );
}
