'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { AdminDataProvider } from '@/components/admin/admin-data';
import { PasswordChangeRequired } from '@/components/admin/password-change-required';
import { displayName, useCommunity } from '@/components/session/community-provider';
import { resolveHeaderBrand } from '@/lib/community-settings';

const sectionGroups = [
  {
    label: 'Community',
    items: [
      { href: '/admin', label: 'Overview', icon: '⌂' },
      { href: '/admin/users', label: 'Users', icon: '◎' },
      { href: '/admin/groups', label: 'Groups', icon: '◍' },
      { href: '/admin/discussions', label: 'Discussions', icon: '▤' },
      { href: '/admin/categories', label: 'Categories', icon: '▦' },
      { href: '/admin/tags', label: 'Tags', icon: '◇' },
      { href: '/admin/moderation', label: 'Moderation', icon: '!' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { href: '/admin/settings', label: 'Basics', icon: '⚙' },
      { href: '/admin/appearance', label: 'Appearance', icon: '◐' },
      { href: '/admin/header', label: 'Header menu', icon: '☰' },
      { href: '/admin/email', label: 'Email', icon: '✉' },
    ],
  },
];

function AccessMessage({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card compact-card admin-access">
        <span className="auth-mark">!</span>
        <h1>{title}</h1>
        <p>{copy}</p>
        {action}
      </section>
    </main>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, user, isAdmin, settings, signOut } = useCommunity();
  const brand = resolveHeaderBrand(settings);

  if (!ready) {
    return (
      <main className="admin-content">
        <div className="admin-loading">Checking administrator access…</div>
      </main>
    );
  }

  if (!user) {
    return (
      <AccessMessage
        title="Log in to continue"
        copy="The administration console is only available to signed-in administrators."
        action={
          <Link
            className="button button-primary button-block"
            href={`/login?next=${encodeURIComponent(pathname)}`}
          >
            Log in as administrator
          </Link>
        }
      />
    );
  }

  if (!isAdmin) {
    return (
      <AccessMessage
        title="Administrator access required"
        copy={`You are signed in as ${displayName(user)}, which does not have administrator permissions.`}
        action={
          <Link className="button button-primary button-block" href="/">
            Back to the community
          </Link>
        }
      />
    );
  }

  if (user.password_change_required) return <PasswordChangeRequired />;

  async function logout() {
    await signOut();
    router.push('/login');
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <span>{brand.mark}</span>
          <div>
            <strong>{brand.name}</strong>
            <small>Administration</small>
          </div>
        </Link>
        <nav aria-label="Administration sections">
          {sectionGroups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <Link
                  className={pathname === item.href ? 'active' : ''}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  href={item.href}
                  key={item.href}
                >
                  <i aria-hidden="true">{item.icon}</i>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link href="/">View community</Link>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span>Community console</span>
            <strong>Signed in as {displayName(user)}</strong>
          </div>
          <Link className="button" href="/">
            View forum
          </Link>
        </header>
        <AdminDataProvider>{children}</AdminDataProvider>
      </div>
    </div>
  );
}
