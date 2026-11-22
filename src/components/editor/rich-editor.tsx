'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

import { editorMarkdown } from '@/components/editor/editor-markdown';
import {
  attachmentType,
  composeRichValue,
  escapeHtml,
  extractAttachments,
  formatBytes,
  renderRichContent,
  safeLinkSource,
  stripAttachments,
} from '@/lib/rich-content';
import type { RichAttachment } from '@/lib/rich-content';

const maxImageBytes = 1024 * 1024;
const maxAttachmentBytes = 2 * 1024 * 1024;
const maxAttachments = 3;

const icons = {
  bold: '<path d="M8 5v14M8 5h5a3 3 0 0 1 0 6H8m0 0h5.5a3.5 3.5 0 0 1 0 7H8"/>',
  italic: '<path d="M10 5h8M6 19h8M14 5 10 19"/>',
  underline: '<path d="M7 5v6a5 5 0 0 0 10 0V5M5 21h14"/>',
  strike:
    '<path d="M7 8.5C7 6.6 8.8 5 12 5s5 1.4 5 3.5M6 12h12M8 15.5c0 2 1.8 3.5 5 3.5s5-1.6 5-3.5"/>',
  bullets:
    '<circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/><path d="M9 7h10M9 12h10M9 17h10"/>',
  numbers:
    '<path d="M4 6h1v3M4 9h2M4 12.5c.4-.4.8-.5 1.2-.5.8 0 1.3.4 1.3 1 0 .5-.3.8-.8 1.2L4 16h2.6M4 18h1.2c.8 0 1.3.4 1.3 1s-.5 1-1.3 1H4M10 7h9M10 13h9M10 19h9"/>',
  link: '<path d="M10.5 13.5 13.5 10M9 16l-1 1a4 4 0 0 1-5.7-5.7l3-3A4 4 0 0 1 11 8M15 8l1-1a4 4 0 0 1 5.7 5.7l-3 3A4 4 0 0 1 13 16"/>',
  clear: '<path d="m5 16 7-11 7 11M8 12h8M4 20h16"/><path d="m17 5 3 3M20 5l-3 3"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 17 4-4 3 3 3-3 6 6"/>',
  file: '<path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/>',
} as const;

function EditorIcon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      className="editor-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icons[name] }}
    />
  );
}

const commands = [
  { command: 'bold', label: 'Bold', icon: 'bold' },
  { command: 'italic', label: 'Italic', icon: 'italic' },
  { command: 'underline', label: 'Underline', icon: 'underline' },
  { command: 'strikeThrough', label: 'Strikethrough', icon: 'strike' },
] as const;

const listCommands = [
  { command: 'insertUnorderedList', label: 'Bulleted list', icon: 'bullets' },
  { command: 'insertOrderedList', label: 'Numbered list', icon: 'numbers' },
] as const;

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type RichEditorProps = {
  id: string;
  label: string;
  placeholder: string;
  initialValue?: string;
  onChange: (value: string) => void;
};

/**
 * WYSIWYG editor that stores content as the Markdown subset understood by renderRichContent.
 * The editable region is uncontrolled; remount with a new `key` to reset it.
 */
export function RichEditor({
  id,
  label,
  placeholder,
  initialValue = '',
  onChange,
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<RichAttachment[]>(() =>
    extractAttachments(initialValue),
  );
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const emit = useCallback(
    (files: RichAttachment[]) => {
      const editor = editorRef.current;
      onChange(composeRichValue(editor ? editorMarkdown(editor) : '', files));
    },
    [onChange],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const content = stripAttachments(initialValue);
    editor.innerHTML = content ? renderRichContent(content) : '';
    // The initial value is applied once per mount; the editor is uncontrolled afterwards.
  }, []);

  useEffect(() => {
    emit(attachments);
  }, [attachments, emit]);

  function say(text: string, error = false) {
    setNotice({ text, error });
  }

  function run(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emit(attachments);
  }

  function insertLink() {
    const selected = window.getSelection()?.toString().trim();
    if (!selected) return say('Select the text you want to link first.', true);
    const url = window.prompt('Link URL (https:// or mailto:)');
    if (url === null) return;
    const safe = safeLinkSource(url);
    if (!safe) return say('Please enter a valid http, https, or mailto link.', true);
    run('createLink', safe);
  }

  async function addImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
      return say('Please choose a PNG, JPG, GIF, or WebP image.', true);
    }
    if (file.size > maxImageBytes) return say('Images must be 1 MB or smaller.', true);

    const source = await readFile(file);
    const name = escapeHtml(file.name || 'Attached image');
    editorRef.current?.insertAdjacentHTML(
      'beforeend',
      `<figure><img src="${escapeHtml(source)}" alt="${name}"><figcaption>${name}</figcaption></figure><p><br></p>`,
    );
    editorRef.current?.focus();
    emit(attachments);
    say('Image added to your post.');
  }

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    if (attachments.length + files.length > maxAttachments) {
      return say(`You can attach up to ${maxAttachments} files.`, true);
    }
    const total = [...attachments, ...files].reduce((sum, file) => sum + file.size, 0);
    if (total > maxAttachmentBytes)
      return say('Attachments must be 2 MB or smaller in total.', true);

    const added = await Promise.all(
      files.map(async (file) => {
        const result = await readFile(file);
        return {
          name: file.name.slice(0, 180) || 'Attachment',
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: `data:application/octet-stream;base64,${result.slice(result.indexOf(',') + 1)}`,
        };
      }),
    );
    setAttachments((current) => [...current, ...added]);
    say(`${added.length === 1 ? added[0].name : `${added.length} files`} attached.`);
  }

  function removeAttachment(index: number) {
    const removed = attachments[index];
    setAttachments((current) => current.filter((_, position) => position !== index));
    say(`${removed?.name || 'Attachment'} removed.`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
  }

  function onPickerKey(event: KeyboardEvent<HTMLLabelElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.currentTarget.querySelector('input')?.click();
    }
  }

  return (
    <div className="rich-editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
        <select
          className="editor-block"
          aria-label="Paragraph style"
          title="Paragraph style"
          value="p"
          onChange={(event) => run('formatBlock', event.target.value)}
        >
          <option value="p">Paragraph</option>
          <option value="h2">Heading 1</option>
          <option value="h3">Heading 2</option>
          <option value="blockquote">Quote</option>
          <option value="pre">Code block</option>
        </select>
        <span className="editor-divider" aria-hidden="true" />
        {commands.map((item) => (
          <button
            className="editor-tool"
            type="button"
            title={item.label}
            aria-label={item.label}
            key={item.command}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(item.command)}
          >
            <EditorIcon name={item.icon} />
          </button>
        ))}
        <span className="editor-divider" aria-hidden="true" />
        {listCommands.map((item) => (
          <button
            className="editor-tool"
            type="button"
            title={item.label}
            aria-label={item.label}
            key={item.command}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(item.command)}
          >
            <EditorIcon name={item.icon} />
          </button>
        ))}
        <button
          className="editor-tool"
          type="button"
          title="Insert link"
          aria-label="Insert link"
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertLink}
        >
          <EditorIcon name="link" />
        </button>
        <button
          className="editor-tool"
          type="button"
          title="Clear formatting"
          aria-label="Clear formatting"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run('removeFormat')}
        >
          <EditorIcon name="clear" />
        </button>
        <span className="editor-divider" aria-hidden="true" />
        <label
          className="editor-tool editor-image"
          title="Add image"
          aria-label="Add image"
          tabIndex={0}
          role="button"
          onKeyDown={onPickerKey}
        >
          <EditorIcon name="image" />
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={addImage}
          />
        </label>
        <label
          className="editor-tool editor-file"
          title="Attach files"
          aria-label="Attach files"
          tabIndex={0}
          role="button"
          onKeyDown={onPickerKey}
        >
          <EditorIcon name="file" />
          <input type="file" multiple onChange={addFiles} />
        </label>
      </div>

      <div
        id={id}
        ref={editorRef}
        className="rich-editor-input rich-content"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder={placeholder}
        onInput={() => emit(attachments)}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
        }}
      />

      {attachments.length ? (
        <div className="editor-attachments" aria-live="polite">
          {attachments.map((file, index) => (
            <div className="attachment-card" key={`${file.name}-${index}`}>
              <span className="attachment-type">{attachmentType(file)}</span>
              <div className="attachment-copy">
                <b>{file.name}</b>
                <small>
                  {file.type || 'File'} · {formatBytes(file.size)}
                </small>
              </div>
              <button
                type="button"
                className="attachment-remove"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeAttachment(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <p
        className={notice?.error ? 'editor-help editor-notice-error' : 'editor-help'}
        role="status"
      >
        {notice?.text ||
          'Format as you type. Paste is added as plain text for safety. Images up to 1 MB; up to 3 files and 2 MB total.'}
      </p>
    </div>
  );
}

export function RichContent({ value, className = '' }: { value: string; className?: string }) {
  return (
    <div
      className={`rich-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: renderRichContent(value) }}
    />
  );
}
