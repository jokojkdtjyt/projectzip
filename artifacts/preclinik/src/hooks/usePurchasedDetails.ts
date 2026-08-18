import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { getExtraHeaders } from '@workspace/api-client-react';

export type PurchasedDetail = {
  moduleId: string;
  /** '3month' | '1year' | 'lifetime' */
  tier: string;
  /** ISO string or null for lifetime */
  expiresAt: string | null;
  isExpired: boolean;
};

export function usePurchasedDetails() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ['/api/purchased/details'],
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PurchasedDetail[]> => {
      const token = await getToken();
      const res = await fetch('/api/purchased/details', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...getExtraHeaders(),
        },
      });
      if (!res.ok) return [];
      return res.json() as Promise<PurchasedDetail[]>;
    },
  });
}

/** Human-readable expiry label. Returns null for lifetime (no label). */
export function formatExpiry(expiresAt: string | null, isExpired: boolean): string | null {
  if (!expiresAt) return null; // lifetime
  if (isExpired) return 'Expired';
  const expiry = new Date(expiresAt);
  const now = new Date();
  const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days > 365) return `${Math.floor(days / 365)}y left`;
  if (days > 30) return `${Math.floor(days / 30)}mo left`;
  if (days === 1) return '1 day left';
  return `${days}d left`;
}

export function tierLabel(tier: string): string {
  if (tier === '3month') return '3-Month';
  if (tier === '1year') return '1-Year';
  return 'Lifetime';
}
