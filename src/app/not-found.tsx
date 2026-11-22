import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="content-page">
      <div className="empty-state not-found">
        <span>404</span>
        <h1>Page not found</h1>
        <p>The page may have moved, or the conversation no longer exists.</p>
        <Link className="button button-primary" href="/">
          Back to discussions
        </Link>
      </div>
    </main>
  );
}
