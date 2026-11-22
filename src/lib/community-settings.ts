export type HeaderMenuLink = { label: string; url: string; visible: boolean };

export type HeaderMenu = {
  discussions: { label: string; visible: boolean };
  resources: HeaderMenuLink;
  administration: { label: string; visible: boolean };
  custom: HeaderMenuLink[];
};

export type HeaderBrand = { mark: string; name: string; tagline: string };

export type CommunitySettings = {
  title?: string;
  description?: string;
  welcome?: string;
  registration?: 'open' | 'closed';
  primary?: string;
  secondary?: string;
  dark?: boolean;
  coloredHeader?: boolean;
  headerBrand?: Partial<HeaderBrand>;
  headerMenu?: Partial<HeaderMenu>;
  mailDriver?: string;
  mailFrom?: string;
  mailHost?: string;
  mailPort?: number;
  [key: string]: unknown;
};

export const defaultCommunityTitle = 'Flarum Community';
export const defaultWelcome = 'Ideas get better when everyone can contribute.';
export const defaultPrimaryColor = '#e7672e';
export const maxCustomHeaderLinks = 6;

/** Accepts absolute http(s) URLs and same-site paths; rejects everything else. */
export function safeHeaderMenuUrl(value: unknown) {
  const source = String(value || '').trim();
  if (/^\/(?!\/)/.test(source)) return source;
  try {
    const url = new URL(source);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function isExternalUrl(url: string) {
  return !url.startsWith('/');
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  return (
    String(value ?? '')
      .trim()
      .slice(0, maxLength) || fallback
  );
}

export function resolveHeaderBrand(settings: CommunitySettings): HeaderBrand {
  const brand = settings.headerBrand || {};
  return {
    mark: cleanText(brand.mark, 'F', 3),
    name: cleanText(brand.name, 'Flarum', 40),
    tagline: cleanText(brand.tagline, 'Community', 40),
  };
}

export function resolveHeaderMenu(settings: CommunitySettings): HeaderMenu {
  const menu = settings.headerMenu || {};
  const custom = Array.isArray(menu.custom) ? menu.custom : [];
  return {
    discussions: {
      label: cleanText(menu.discussions?.label, 'Discussions', 40),
      visible: menu.discussions?.visible !== false,
    },
    resources: {
      label: cleanText(menu.resources?.label, 'Resources', 40),
      url: safeHeaderMenuUrl(menu.resources?.url) || 'https://docs.flarum.org',
      visible: menu.resources?.visible !== false,
    },
    administration: {
      label: cleanText(menu.administration?.label, 'Administration', 40),
      visible: menu.administration?.visible !== false,
    },
    custom: custom.slice(0, maxCustomHeaderLinks).map((item) => ({
      label: String(item?.label || '')
        .trim()
        .slice(0, 40),
      url: String(item?.url || '').trim(),
      visible: item?.visible !== false,
    })),
  };
}

/** Returns a user-facing problem with a header configuration, or an empty string. */
export function validateHeaderSettings(brand: HeaderBrand, menu: HeaderMenu) {
  if (!brand.mark.trim() || !brand.name.trim() || !brand.tagline.trim()) {
    return 'Logo mark, brand name, and tagline are required.';
  }
  const labels = [
    menu.discussions.label,
    menu.resources.label,
    menu.administration.label,
    ...menu.custom.map((item) => item.label),
  ];
  if (labels.some((label) => !label.trim())) return 'Every menu item needs a label.';
  if (menu.custom.length > maxCustomHeaderLinks) {
    return `You can add up to ${maxCustomHeaderLinks} custom links.`;
  }
  const urls = [menu.resources.url, ...menu.custom.map((item) => item.url)];
  if (urls.some((url) => !safeHeaderMenuUrl(url))) {
    return 'Enter an http(s) URL or a local path beginning with /.';
  }
  return '';
}

export function isHexColor(value: unknown) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ''));
}
