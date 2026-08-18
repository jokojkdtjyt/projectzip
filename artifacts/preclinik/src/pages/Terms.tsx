import { Link } from "wouter";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      {/* Simple header */}
      <header className="sticky top-0 z-40 h-[64px] border-b border-border bg-white/80 backdrop-blur-md px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[#b9852e] flex items-center justify-center text-white font-bold font-serif text-sm shadow-sm">
            P
          </div>
          <span className="font-serif font-bold text-base text-foreground">
            PreClinik
          </span>
        </Link>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          ← Back
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16 space-y-10">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Terms of Service & Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground font-mono">
          Last updated: July 2026
        </p>

        {/* ── What this is ── */}
        <section className="space-y-2">
          <p className="text-sm text-foreground leading-relaxed">
            This page explains how PreClinik works, what information we collect,
            and what you can expect when you use the platform. It's written in
            plain language — nothing hidden.
          </p>
        </section>

        {/* ── 1. What we collect ── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">
            1. Information we collect
          </h2>
          <p className="text-sm text-foreground leading-relaxed">
            When you create an account, we collect:
          </p>
          <ul className="list-disc pl-5 text-sm text-foreground leading-relaxed space-y-1">
            <li>
              <strong>Your email address</strong> — used to identify your
              account and send purchase notifications.
            </li>
            <li>
              <strong>Your name</strong> — shown to admins when you submit a
              purchase request.
            </li>
            <li>
              <strong>Payment receipt images</strong> — uploaded when you
              purchase a module (see section 3).
            </li>
            <li>
              <strong>Lesson progress data</strong> — which lessons you've
              watched and quiz answers, used to show your progress.
            </li>
          </ul>
        </section>

        {/* ── 2. How payments work ── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">
            2. How payments work
          </h2>
          <p className="text-sm text-foreground leading-relaxed">
            PreClinik does not process payments automatically. Here's how it works:
          </p>
          <ol className="list-decimal pl-5 text-sm text-foreground leading-relaxed space-y-2">
            <li>
              You send the module price to our CCP account (Algerian postal
              payment).
            </li>
            <li>
              You upload a photo of your payment receipt through the website.
            </li>
            <li>
              An admin reviews the receipt manually and activates your access.
              This usually happens within a few hours.
            </li>
          </ol>
          <p className="text-sm text-foreground leading-relaxed">
            Access is not instant. You will not be charged automatically for
            anything — every purchase is reviewed by a human first.
          </p>
        </section>

        {/* ── 3. Receipt images ── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">
            3. Receipt images
          </h2>
          <p className="text-sm text-foreground leading-relaxed">
            Receipt photos you upload are <strong>only</strong> used to verify
            that you made a payment. They are:
          </p>
          <ul className="list-disc pl-5 text-sm text-foreground leading-relaxed space-y-1">
            <li>Stored securely and only visible to site admins.</li>
            <li>
              Never shared with third parties or used for any other purpose.
            </li>
            <li>
              Deleted from our servers once your purchase is approved.
            </li>
          </ul>
        </section>

        {/* ── 4. Access terms ── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">
            4. Module access and tiers
          </h2>
          <p className="text-sm text-foreground leading-relaxed">
            When you purchase a module, you get access based on the tier you
            selected:
          </p>
          <ul className="list-disc pl-5 text-sm text-foreground leading-relaxed space-y-1">
            <li>
              <strong>3-Month access</strong> — expires 90 days after purchase
              approval.
            </li>
            <li>
              <strong>1-Year access</strong> — expires 365 days after purchase
              approval.
            </li>
            <li>
              <strong>Lifetime access</strong> — never expires. You keep access
              as long as the platform operates.
            </li>
          </ul>
          <p className="text-sm text-foreground leading-relaxed">
            After your access expires, the module will show as "Expired" in your
            library. You can purchase it again to regain access.
          </p>
        </section>

        {/* ── 5. Data sharing ── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">
            5. Data sharing
          </h2>
          <p className="text-sm text-foreground leading-relaxed">
            We use trusted third-party services to handle account sign-in,
            secure payment verification, and data storage. We never sell
            your personal data to anyone.
          </p>
        </section>

        {/* ── 6. Contact ── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">
            6. Questions?
          </h2>
          <p className="text-sm text-foreground leading-relaxed">
            If you have any questions about these terms, your data, or a
            purchase, contact us through the platform or reach out to the
            PreClinik admin team.
          </p>
        </section>

        <div className="pt-6 border-t border-border">
          <Link
            href="/"
            className="text-sm text-primary hover:text-primary/80 font-bold transition-colors"
          >
            ← Back to PreClinik
          </Link>
        </div>
      </main>
    </div>
  );
}
