'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  displayName,
  themeStorageKey,
  useCommunity,
} from '@/components/session/community-provider';
import { isExternalUrl, resolveHeaderBrand, resolveHeaderMenu } from '@/lib/community-settings';
import { api } from '@/utils/api/client';

type NavItem = { href: string; label: string; external: boolean; active: boolean };

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" onClick={onNavigate}>
        {item.label}
      </a>
    );
  }
  return (
    <Link className={item.active ? 'active' : ''} href={item.href} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, settings, user, isAdmin, signOut } = useCommunity();
  const [dark, setDark] = useState(false);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark');
  }, [settings]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    api<{ notifications: { is_read?: boolean }[] }>('/api/notifications')
      .then((result) => setUnread(result.notifications.filter((item) => !item.is_read).length))
      .catch(() => setUnread(0));
  }, [user, pathname]);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  if (pathname.startsWith('/admin')) return null;

  const brand = resolveHeaderBrand(settings);
  const menu = resolveHeaderMenu(settings);
  const navItems: NavItem[] = [];
  if (menu.discussions.visible) {
    navItems.push({
      href: '/',
      label: menu.discussions.label,
      external: false,
      active: pathname === '/' || pathname.startsWith('/discussions'),
    });
  }
  if (menu.resources.visible) {
    navItems.push({
      href: menu.resources.url,
      label: menu.resources.label,
      external: isExternalUrl(menu.resources.url),
      active: pathname === menu.resources.url,
    });
  }
  for (const item of menu.custom) {
    if (!item.visible || !item.label || !item.url) continue;
    navItems.push({
      href: item.url,
      label: item.label,
      external: isExternalUrl(item.url),
      active: pathname === item.url,
    });
  }
  if (isAdmin && menu.administration.visible) {
    navItems.push({
      href: '/admin',
      label: menu.administration.label,
      external: false,
      active: false,
    });
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem(themeStorageKey, next ? 'dark' : 'light');
    } catch {
      // Theme still applies for this visit when storage is unavailable.
    }
  }

  async function logout() {
    setMenuOpen(false);
    await signOut();
    router.push('/login');
  }

  const name = displayName(user);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/" aria-label={`${brand.name} ${brand.tagline} home`}>
          <span className="brand-mark">{brand.mark}</span>
          <span className="brand-copy">
            <strong>{brand.name}</strong>
            <small>{brand.tagline}</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink item={item} key={`${item.href}-${item.label}`} />
          ))}
        </nav>

        <div className="header-actions" ref={menuRef}>
          <button
            className="icon-button"
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
            title={dark ? 'Use light theme' : 'Use dark theme'}
          >
            {dark ? '☀' : '☾'}
          </button>
          {user ? (
            <Link
              className="icon-button notification-button"
              href="/notifications"
              aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            >
              ♢
              {unread ? (
                <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>
              ) : null}
            </Link>
          ) : null}
          {ready && !user ? (
            <>
              <Link className="button button-quiet header-signup" href="/signup">
                Sign up
              </Link>
              <Link className="button button-primary" href="/login">
                Log in
              </Link>
            </>
          ) : null}
          <button
            className={user ? 'account-button' : 'icon-button menu-button'}
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={user ? `Account menu for ${name}` : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {user ? (
              <>
                <span
                  className="avatar avatar-small"
                  style={{ backgroundColor: user.profile?.avatar_color || '#6c5ce7' }}
                  aria-hidden="true"
                >
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <span className="account-name">{name}</span>
              </>
            ) : (
              '☰'
            )}
          </button>

          {menuOpen ? (
            <div className="header-menu" role="menu">
              {user ? (
                <div className="header-menu-identity">
                  <strong>{name}</strong>
                  <small>{user.email}</small>
                </div>
              ) : null}
              <div className="header-menu-nav">
                {navItems.map((item) => (
                  <NavLink
                    item={item}
                    key={`menu-${item.href}-${item.label}`}
                    onNavigate={() => setMenuOpen(false)}
                  />
                ))}
              </div>
              {user ? (
                <>
                  <Link href="/discussions/new" onClick={() => setMenuOpen(false)}>
                    Start a discussion
                  </Link>
                  <Link href="/notifications" onClick={() => setMenuOpen(false)}>
                    Notifications{unread ? ` (${unread})` : ''}
                  </Link>
                  <button type="button" onClick={logout}>
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    Log in
                  </Link>
                  <Link href="/signup" onClick={() => setMenuOpen(false)}>
                    Create an account
                  </Link>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
