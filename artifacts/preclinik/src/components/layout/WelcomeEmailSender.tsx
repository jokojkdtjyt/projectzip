import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";

/**
 * Detects a new user sign-up (first time `userId` appears) and fires a
 * one-time POST to the backend to send the welcome email.
 *
 * Tracks "sent" state in sessionStorage per userId so it only fires once
 * per browser session per user — no matter how often this component re-mounts.
 */
export function WelcomeEmailSender() {
  const { userId, isSignedIn, isLoaded } = useAuth();
  const calledRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    if (calledRef.current) return;

    const key = `welcome_email_sent_${userId}`;
    if (sessionStorage.getItem(key)) return;

    calledRef.current = true;

    fetch("/api/users/welcome", { method: "POST" })
      .then((r) => {
        if (r.ok) {
          sessionStorage.setItem(key, "1");
        }
      })
      .catch(() => {
        // Silently ignore — email is best-effort
      });
  }, [isLoaded, isSignedIn, userId]);

  return null;
}
