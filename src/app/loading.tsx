/** Shown instantly while the next page renders on the server. */
export default function Loading() {
  return (
    <main className="content-page" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="skeleton-stack" aria-hidden="true">
        <span className="skeleton skeleton-hero" />
        <span className="skeleton skeleton-row" />
        <span className="skeleton skeleton-row" />
        <span className="skeleton skeleton-row" />
      </div>
    </main>
  );
}
