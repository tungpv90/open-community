import assert from 'node:assert/strict';
import test from 'node:test';

import { importTypeScript } from './helpers/load-typescript.js';

const {
  attachmentMarker,
  composeRichValue,
  contentExcerpt,
  extractAttachments,
  renderRichContent,
  stripAttachments,
} = await importTypeScript('src/lib/rich-content.ts');

test('rich content renders formatting stored as Markdown', () => {
  const html = renderRichContent(
    '# Heading\n\n**Bold** and ++underlined++\n\n- First\n- Second\n\n[Docs](https://example.com)',
  );

  assert.match(html, /<h2>Heading<\/h2>/);
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /<u>underlined<\/u>/);
  assert.match(html, /<ul><li>First<\/li><li>Second<\/li><\/ul>/);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('rich content escapes HTML and rejects unsafe links and images', () => {
  const html = renderRichContent(
    '<img src=x onerror=alert(1)>\n[Click](javascript:alert(1))\n![x](javascript:alert(1))',
  );

  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /href=/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('code blocks are escaped and kept verbatim', () => {
  const html = renderRichContent('```\n<b>not bold</b>\n**still raw**\n```');

  assert.equal(html, '<pre><code>&lt;b&gt;not bold&lt;/b&gt;\n**still raw**</code></pre>');
});

test('attachments round-trip through the stored marker format', () => {
  const file = {
    name: 'report final.pdf',
    type: 'application/pdf',
    size: 2048,
    data: 'data:application/octet-stream;base64,SGVsbG8=',
  };
  const value = composeRichValue('Please review', [file]);

  assert.equal(value, `Please review\n\n${attachmentMarker(file)}`);
  assert.deepEqual(extractAttachments(value), [file]);
  assert.equal(stripAttachments(value), 'Please review');
  assert.match(renderRichContent(value), /class="attachment-card".*PDF.*report final\.pdf/s);
});

test('excerpts drop markup, images, and attachments', () => {
  const file = {
    name: 'a.txt',
    type: 'text/plain',
    size: 1,
    data: 'data:application/octet-stream;base64,YQ==',
  };
  const value = composeRichValue(
    '# Title\n\n![pic](data:image/png;base64,AAAA)\n**Bold** [link](https://example.com)\n- item',
    [file],
  );

  assert.equal(contentExcerpt(value), 'Title Bold link item');
});
