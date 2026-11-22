import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { cache } from 'react';

import '@/styles/globals.css';
import '@/styles/community.css';
import '@/styles/auth.css';
import '@/styles/admin.css';
import '@/styles/editor.css';

import { SiteHeader } from '@/components/layout/site-header';
import { CommunityProvider } from '@/components/session/community-provider';
import type { CommunityConfig } from '@/components/session/community-provider';
import { defaultCommunityTitle, defaultPrimaryColor, isHexColor } from '@/lib/community-settings';
import { loadCommunityConfig } from '@/server/routes/system.js';
import { getServerEnvironment } from '@/utils/server-environment';

// Render pages per request so they are sent with `no-store`. Prerendered pages carry
// `s-maxage=31536000`, which lets a caching reverse proxy serve an old build for a year.
export const dynamic = 'force-dynamic';

/** Loads the saved settings once per request so the first paint matches them. */
const getCommunityConfig = cache(
  async (): Promise<CommunityConfig> => loadCommunityConfig(getServerEnvironment()),
);

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getCommunityConfig();
  const title = String(settings.title || defaultCommunityTitle);
  return {
    title: { default: title, template: `%s · ${title}` },
    description: String(
      settings.description || 'Get help, share knowledge, and connect with the community.',
    ),
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { settings } = await getCommunityConfig();
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: isHexColor(settings.primary) ? String(settings.primary) : defaultPrimaryColor,
  };
}

// Applies the saved theme before first paint so dark mode does not flash light.
const themeScript = `try{var t=localStorage.getItem('community_theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const config = await getCommunityConfig();
  const { settings } = config;
  const brandStyle: Record<string, string> = {};
  if (isHexColor(settings.primary)) brandStyle['--brand'] = String(settings.primary);
  if (isHexColor(settings.secondary)) brandStyle['--secondary'] = String(settings.secondary);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={settings.coloredHeader ? 'colored-header' : undefined}
      data-theme={settings.dark ? 'dark' : 'light'}
      style={brandStyle as CSSProperties}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <CommunityProvider initialConfig={config}>
          <SiteHeader />
          {children}
        </CommunityProvider>
      </body>
    </html>
  );
}
