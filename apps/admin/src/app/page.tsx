/**
 * Shell (T-027). The admin is a tool, not a statement: dense, zero motion.
 * Auth arrives in T-063 and the order board in T-069 — until then this page
 * is deliberately empty rather than a mock that looks finished.
 */
export default function AdminHome() {
  return (
    <main className="min-h-dvh bg-void text-paper font-sans text-[13px] p-6">
      <h1 className="text-[15px] font-semibold">NOWCORE</h1>
      <p className="font-mono text-[9px] uppercase tracking-[var(--tracking-micro)] text-smoke">
        Admin
      </p>
      <p className="mt-8 text-smoke">
        Nothing here yet — sign-in lands with T-063, the order board with T-069.
      </p>
    </main>
  );
}
