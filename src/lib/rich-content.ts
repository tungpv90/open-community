export type RichAttachment = {
  name: string;
  type: string;
  size: number;
  data: string;
};

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => htmlEscapes[character]);
}

export function safeLinkSource(value: unknown) {
  const source = String(value || '').trim();
  return /^(?:https?:\/\/|mailto:)[^\s]+$/i.test(source) ? source : '';
}

export function safeImageSource(value: unknown) {
  const source = String(value || '').trim();
  return /^https?:\/\/[^\s]+$/i.test(source) ||
    /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(source)
    ? source
    : '';
}

function inlineRich(text: string) {
  const tokens: string[] = [];
  const token = (html: string) => {
    tokens.push(html);
    return `\u0000${tokens.length - 1}\u0000`;
  };

  let raw = String(text || '').replace(/`([^`\n]+)`/g, (_, value: string) =>
    token(`<code>${escapeHtml(value)}</code>`),
  );
  raw = raw.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, label: string, url: string) => {
    const source = safeImageSource(url);
    return source
      ? token(
          `<img class="rich-inline-image" src="${escapeHtml(source)}" alt="${escapeHtml(label)}">`,
        )
      : label;
  });
  raw = raw.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, url: string) => {
    const source = safeLinkSource(url);
    return source
      ? token(
          `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`,
        )
      : label;
  });

  const safe = escapeHtml(raw)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
    .replace(/\+\+([^+\n]+)\+\+/g, '<u>$1</u>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  return safe.replace(/\u0000(\d+)\u0000/g, (_, index: string) => tokens[Number(index)]);
}

export function formatBytes(value: number) {
  const size = Number(value) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10240 ? 1 : 0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function parseAttachmentLine(line: string): RichAttachment | null {
  const match = String(line || '').match(
    /^:::attachment\|([^|]*)\|([^|]*)\|(\d+)\|(data:application\/octet-stream;base64,[a-z0-9+/=]*):::$/i,
  );
  if (!match) return null;
  try {
    return {
      name: decodeURIComponent(match[1]).slice(0, 180) || 'Attachment',
      type: decodeURIComponent(match[2]).slice(0, 120) || 'application/octet-stream',
      size: Number(match[3]) || 0,
      data: match[4],
    };
  } catch {
    return null;
  }
}

export function attachmentMarker(file: RichAttachment) {
  return `:::attachment|${encodeURIComponent(file.name)}|${encodeURIComponent(
    file.type || 'application/octet-stream',
  )}|${file.size}|${file.data}:::`;
}

export function attachmentType(file: Pick<RichAttachment, 'name' | 'type'>) {
  const value = `${file.name} ${file.type}`.toLowerCase();
  if (value.includes('pdf')) return 'PDF';
  if (/word|\.docx?\b/.test(value)) return 'DOC';
  if (/excel|spreadsheet|\.xlsx?\b|\.csv\b/.test(value)) return 'XLS';
  if (/powerpoint|presentation|\.pptx?\b/.test(value)) return 'PPT';
  if (/zip|rar|7z|tar|gzip/.test(value)) return 'ZIP';
  if (file.type.startsWith('image/')) return 'IMG';
  return 'FILE';
}

function attachmentCard(file: RichAttachment) {
  return `<div class="attachment-card"><span class="attachment-type">${attachmentType(
    file,
  )}</span><div class="attachment-copy"><b>${escapeHtml(file.name)}</b><small>${escapeHtml(
    file.type || 'File',
  )} · ${formatBytes(file.size)}</small></div><a class="attachment-download" href="${escapeHtml(
    file.data,
  )}" download="${escapeHtml(file.name)}">Download</a></div>`;
}

export function extractAttachments(value: string) {
  return String(value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(parseAttachmentLine)
    .filter((file): file is RichAttachment => Boolean(file));
}

export function stripAttachments(value: string) {
  return String(value || '')
    .replace(/^:::attachment\|.*:::$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function composeRichValue(content: string, attachments: RichAttachment[]) {
  return [content, ...attachments.map(attachmentMarker)].filter(Boolean).join('\n\n');
}

function collectLines(lines: string[], start: number, pattern: RegExp) {
  const items: string[] = [];
  let index = start;
  while (index < lines.length && pattern.test(lines[index])) {
    items.push(lines[index].replace(pattern, ''));
    index += 1;
  }
  return { items, next: index - 1 };
}

export function renderRichContent(value: string) {
  const lines = String(value || '')
    .replace(/\r/g, '')
    .split('\n');
  const out: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const attachment = parseAttachmentLine(line);
    if (attachment) {
      out.push(attachmentCard(attachment));
      continue;
    }

    if (line.trim().startsWith('```')) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = collectLines(lines, index, /^>\s?/);
      index = quote.next;
      out.push(
        `<blockquote>${quote.items.map((item) => `<p>${inlineRich(item)}</p>`).join('')}</blockquote>`,
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length + 1;
      out.push(`<h${level}>${inlineRich(heading[2])}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const list = collectLines(lines, index, /^[-*]\s+/);
      index = list.next;
      out.push(`<ul>${list.items.map((item) => `<li>${inlineRich(item)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const list = collectLines(lines, index, /^\d+\.\s+/);
      index = list.next;
      out.push(`<ol>${list.items.map((item) => `<li>${inlineRich(item)}</li>`).join('')}</ol>`);
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\((.+)\)$/);
    const imageSource = image ? safeImageSource(image[2]) : '';
    if (image && imageSource) {
      const label = escapeHtml(image[1] || 'Attached image');
      out.push(
        `<figure><img src="${escapeHtml(imageSource)}" alt="${label}" loading="lazy"><figcaption>${label}</figcaption></figure>`,
      );
      continue;
    }

    if (!line.trim()) {
      out.push('<div class="rich-spacer" aria-hidden="true"></div>');
      continue;
    }

    out.push(`<p>${inlineRich(line)}</p>`);
  }

  return out.join('');
}

/** Plain-text preview of stored rich content, used for cards and notifications. */
export function contentExcerpt(value: string, length = 160) {
  return stripAttachments(value)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_~+>#]/g, '')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length);
}
