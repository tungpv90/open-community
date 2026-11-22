import assert from 'node:assert/strict';
import test from 'node:test';

import { importTypeScript } from './helpers/load-typescript.js';

const { resolveHeaderBrand, resolveHeaderMenu, safeHeaderMenuUrl, validateHeaderSettings } =
  await importTypeScript('src/lib/community-settings.ts');

test('header menu URLs allow http(s) and same-site paths only', () => {
  assert.equal(safeHeaderMenuUrl('/about'), '/about');
  assert.equal(safeHeaderMenuUrl('https://docs.example.com/x'), 'https://docs.example.com/x');
  assert.equal(safeHeaderMenuUrl('//evil.example'), '');
  assert.equal(safeHeaderMenuUrl('javascript:alert(1)'), '');
});

test('header settings fall back to defaults and cap custom links', () => {
  const custom = Array.from({ length: 9 }, (_, index) => ({ label: `L${index}`, url: '/x' }));
  const menu = resolveHeaderMenu({ headerMenu: { resources: { url: 'javascript:x' }, custom } });

  assert.equal(menu.discussions.label, 'Discussions');
  assert.equal(menu.resources.url, 'https://docs.flarum.org');
  assert.equal(menu.custom.length, 6);
  assert.deepEqual(resolveHeaderBrand({ headerBrand: { mark: 'ABCD', name: ' Open ' } }), {
    mark: 'ABC',
    name: 'Open',
    tagline: 'Community',
  });
});

test('header validation reports missing labels and unsafe URLs', () => {
  const brand = { mark: 'OC', name: 'Open', tagline: 'Connect' };
  const menu = resolveHeaderMenu({});

  assert.equal(validateHeaderSettings(brand, menu), '');
  assert.match(
    validateHeaderSettings(brand, { ...menu, custom: [{ label: '', url: '/a', visible: true }] }),
    /label/,
  );
  assert.match(
    validateHeaderSettings(brand, {
      ...menu,
      custom: [{ label: 'A', url: 'ftp://a', visible: true }],
    }),
    /http/,
  );
  assert.match(validateHeaderSettings({ ...brand, mark: ' ' }, menu), /Logo mark/);
});
