import posthog from "posthog-js";
import { useEffect } from "react";
import { useAuth, useClerk } from "@clerk/react";

const RAW_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const RAW_HOST = import.meta.env.VITE_POSTHOG_HOST;

// Resolve defaults — handle both undefined and empty string ('' || '' → fallback)
const POSTHOG_KEY: string | undefined = RAW_KEY || undefined;
const POSTHOG_HOST: string = (RAW_HOST && RAW_HOST.length > 0 ? RAW_HOST : "eu.posthog.com")
  .replace(/\/+$/, "") // strip trailing slash(es)
  // Ensure protocol — env var might be stored as "eu.posthog.com" without https://
  .replace(/^(?!(?:https?:)?\/\/)/, "https://");

/**
 * Call once at the top of the app to initialise PostHog.
 * Safe to call multiple times — posthog-js guards re-init internally.
 */
export function initPostHog(): void {
  if (!POSTHOG_KEY) {
    console.warn("[PostHog] No API key — analytics disabled");
    return;
  }
  if (typeof window === "undefined") return; // SSR guard

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // we do it manually with wouter
    loaded: (ph) => {
      // Respect Do Not Track
      if (window.navigator.doNotTrack === "1") ph.opt_out_capturing();
    },
  });
}

/**
 * React hook that:
 * - Identifies the Clerk user in PostHog when signed in
 * - Returns a typed `capture` function for custom events
 *
 * Usage: const { capture } = usePostHog(); capture('module_viewed', { moduleId, title });
 */
export function usePostHog() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useClerk();

  useEffect(() => {
    if (!POSTHOG_KEY) return;

    if (isSignedIn && userId) {
      // Identify with Clerk userId + optional email
      posthog.identify(userId, {
        email: user?.primaryEmailAddress?.emailAddress ?? undefined,
        name: user?.fullName ?? undefined,
      });
    } else {
      // User signed out — reset to anonymous
      posthog.reset();
    }
  }, [isSignedIn, userId, user]);

  /**
   * Capture a named event with optional properties.
   * Automatically includes the current URL path for context.
   */
  const capture = (event: string, properties?: Record<string, unknown>) => {
    if (!POSTHOG_KEY) return;
    posthog.capture(event, {
      path: window.location.pathname,
      ...properties,
    });
  };

  return { capture, posthog };
}
