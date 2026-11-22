/** Shown instantly while a discussion renders on the server. */
export default function Loading() {
  return (
    <main className="content-page discussion-page" aria-busy="true">
      <span className="sr-only">Loading discussion…</span>
      <div className="skeleton-stack" aria-hidden="true">
        <span className="skeleton skeleton-crumb" />
        <span className="skeleton skeleton-hero" />
        <span className="skeleton skeleton-post" />
        <span className="skeleton skeleton-post" />
      </div>
    </main>
  );
}
