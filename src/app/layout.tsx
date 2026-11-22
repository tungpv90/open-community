import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@/styles/globals.css';
import '@/styles/community.css';
import '@/styles/auth.css';
import '@/styles/admin.css';
import '@/styles/editor.css';

import { SiteHeader } from '@/components/layout/site-header';
import { CommunityProvider } from '@/components/session/community-provider';

export const metadata: Metadata = {
  title: { default: 'Flarum Community', template: '%s · Flarum Community' },
  description: 'Get help, share knowledge, and connect with the community.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#e7672e',
};

// Applies the saved theme before first paint so dark mode does not flash light.
const themeScript = `try{var t=localStorage.getItem('community_theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <CommunityProvider>
          <SiteHeader />
          {children}
        </CommunityProvider>
      </body>
    </html>
  );
}
