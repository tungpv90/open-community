import { safeImageSource, safeLinkSource } from '@/lib/rich-content';

/** Serializes the contentEditable DOM into the Markdown subset rendered by renderRichContent. */
function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue || '').replace(/\u00a0/g, ' ');
  if (!(node instanceof HTMLElement)) return '';

  const tag = node.tagName.toLowerCase();
  const content = Array.from(node.childNodes).map(inlineMarkdown).join('');
  if (tag === 'br') return '\n';
  if (tag === 'strong' || tag === 'b') return `**${content}**`;
  if (tag === 'em' || tag === 'i') return `*${content}*`;
  if (tag === 'u') return `++${content}++`;
  if (tag === 's' || tag === 'strike' || tag === 'del') return `~~${content}~~`;
  if (tag === 'code') return `\`${content.replace(/`/g, '\\`')}\``;
  if (tag === 'a') {
    const link = safeLinkSource(node.getAttribute('href'));
    return link ? `[${content}](${link})` : content;
  }
  if (tag === 'img') {
    const source = safeImageSource(node.getAttribute('src'));
    return source ? `![${node.getAttribute('alt') || 'Image'}](${source})` : '';
  }
  if (tag === 'figure') {
    const image = node.querySelector('img');
    const source = image && safeImageSource(image.getAttribute('src'));
    return source ? `![${image.getAttribute('alt') || 'Attached image'}](${source})` : '';
  }
  return content;
}

function listMarkdown(node: HTMLElement, ordered: boolean) {
  return Array.from(node.children)
    .filter((item) => item.tagName.toLowerCase() === 'li')
    .map((item, index) => {
      const prefix = ordered ? `${index + 1}. ` : '- ';
      return prefix + Array.from(item.childNodes).map(inlineMarkdown).join('').trim();
    })
    .join('\n');
}

function blockMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue || '').trim();
  if (!(node instanceof HTMLElement)) return '';

  const tag = node.tagName.toLowerCase();
  const content = Array.from(node.childNodes).map(inlineMarkdown).join('').trim();
  if (tag === 'h1' || tag === 'h2') return `# ${content}`;
  if (tag === 'h3') return `## ${content}`;
  if (tag === 'h4') return `### ${content}`;
  if (tag === 'blockquote') {
    return content
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  }
  if (tag === 'pre') return `\`\`\`\n${(node.textContent || '').replace(/^\n|\n$/g, '')}\n\`\`\``;
  if (tag === 'ul') return listMarkdown(node, false);
  if (tag === 'ol') return listMarkdown(node, true);
  if (tag === 'figure') return inlineMarkdown(node);
  if (node.classList.contains('rich-spacer')) return '';
  return content;
}

export function editorMarkdown(editor: HTMLElement) {
  return Array.from(editor.childNodes)
    .map(blockMarkdown)
    .filter(Boolean)
    .join('\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
