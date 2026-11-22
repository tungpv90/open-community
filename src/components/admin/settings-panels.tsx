'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import {
  ActionMessage,
  AdminPage,
  PageHeading,
  useAdminAction,
  useAdminData,
} from '@/components/admin/admin-data';
import { ColorField, Toggle } from '@/components/admin/form-controls';
import {
  defaultCommunityTitle,
  defaultPrimaryColor,
  defaultWelcome,
  isHexColor,
  maxCustomHeaderLinks,
  resolveHeaderBrand,
  resolveHeaderMenu,
  validateHeaderSettings,
} from '@/lib/community-settings';
import type { CommunitySettings, HeaderMenu } from '@/lib/community-settings';

function SettingsForm({
  onSubmit,
  children,
  message,
  busy,
  submitLabel = 'Save changes',
}: {
  onSubmit: () => void;
  children: ReactNode;
  message: { text: string; error: boolean } | null;
  busy: boolean;
  submitLabel?: string;
}) {
  return (
    <form
      className="admin-card settings-form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <footer>
        <ActionMessage message={message} />
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </footer>
    </form>
  );
}

/** Saves a settings patch with shared busy/message handling. */
function useSettingsSave() {
  const { saveSettings } = useAdminData();
  const action = useAdminAction();
  function save(patch: CommunitySettings, validationError = '') {
    if (validationError) {
      action.setMessage({ text: validationError, error: true });
      return;
    }
    void action.run(() => saveSettings(patch), 'Settings saved');
  }
  return { ...action, save };
}

function BasicsForm({ settings }: { settings: CommunitySettings }) {
  const { busy, message, save } = useSettingsSave();
  const [title, setTitle] = useState(String(settings.title || defaultCommunityTitle));
  const [description, setDescription] = useState(String(settings.description || ''));
  const [welcome, setWelcome] = useState(String(settings.welcome || defaultWelcome));
  const [registration, setRegistration] = useState(settings.registration || 'open');

  return (
    <SettingsForm
      busy={busy}
      message={message}
      onSubmit={() =>
        save(
          {
            title: title.trim(),
            description: description.trim(),
            welcome: welcome.trim(),
            registration,
          },
          title.trim().length < 2 ? 'The community title is required.' : '',
        )
      }
    >
      <section>
        <h2>General</h2>
        <p>Core identity shown throughout the community.</p>
        <label>
          <span>Community title</span>
          <input value={title} maxLength={80} required onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          <span>Description</span>
          <textarea
            value={description}
            maxLength={300}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short summary of what this community is about"
          />
        </label>
        <label>
          <span>Welcome heading</span>
          <input value={welcome} maxLength={140} onChange={(e) => setWelcome(e.target.value)} />
        </label>
      </section>
      <section>
        <h2>Access</h2>
        <p>Choose whether visitors can create new accounts.</p>
        <label>
          <span>Registration</span>
          <select
            value={registration}
            onChange={(e) => setRegistration(e.target.value as 'open' | 'closed')}
          >
            <option value="open">Open — anyone can sign up</option>
            <option value="closed">Closed — no new accounts</option>
          </select>
        </label>
      </section>
    </SettingsForm>
  );
}

function AppearanceForm({ settings }: { settings: CommunitySettings }) {
  const { busy, message, save } = useSettingsSave();
  const [primary, setPrimary] = useState(String(settings.primary || defaultPrimaryColor));
  const [secondary, setSecondary] = useState(String(settings.secondary || '#4d698e'));
  const [dark, setDark] = useState(Boolean(settings.dark));
  const [coloredHeader, setColoredHeader] = useState(Boolean(settings.coloredHeader));

  return (
    <SettingsForm
      busy={busy}
      message={message}
      onSubmit={() =>
        save(
          { primary, secondary, dark, coloredHeader },
          isHexColor(primary) && isHexColor(secondary) ? '' : 'Colors must be 6-digit hex values.',
        )
      }
    >
      <section>
        <h2>Colors</h2>
        <p>The primary color is used for buttons, links, and highlights.</p>
        <ColorField label="Primary color" value={primary} onChange={setPrimary} />
        <ColorField label="Secondary color" value={secondary} onChange={setSecondary} />
      </section>
      <section>
        <h2>Display</h2>
        <p>Defaults for visitors who have not chosen a theme themselves.</p>
        <Toggle
          label="Dark mode by default"
          description="Members can still switch themes from the header."
          checked={dark}
          onChange={setDark}
        />
        <Toggle
          label="Colored header"
          description="Fill the site header with the primary color."
          checked={coloredHeader}
          onChange={setColoredHeader}
        />
      </section>
    </SettingsForm>
  );
}

function MenuToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function HeaderForm({ settings }: { settings: CommunitySettings }) {
  const { busy, message, save } = useSettingsSave();
  const [brand, setBrand] = useState(resolveHeaderBrand(settings));
  const [menu, setMenu] = useState<HeaderMenu>(resolveHeaderMenu(settings));

  function updateCustom(index: number, patch: Partial<HeaderMenu['custom'][number]>) {
    setMenu((current) => ({
      ...current,
      custom: current.custom.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  return (
    <SettingsForm
      busy={busy}
      message={message}
      submitLabel="Save header"
      onSubmit={() =>
        save({ headerBrand: brand, headerMenu: menu }, validateHeaderSettings(brand, menu))
      }
    >
      <section>
        <h2>Brand</h2>
        <p>Shown at the top-left of every page.</p>
        <div className="menu-item-fields">
          <label>
            <span>Logo mark</span>
            <input
              value={brand.mark}
              maxLength={3}
              onChange={(e) => setBrand({ ...brand, mark: e.target.value })}
            />
          </label>
          <label>
            <span>Brand name</span>
            <input
              value={brand.name}
              maxLength={40}
              onChange={(e) => setBrand({ ...brand, name: e.target.value })}
            />
          </label>
        </div>
        <label>
          <span>Tagline</span>
          <input
            value={brand.tagline}
            maxLength={40}
            onChange={(e) => setBrand({ ...brand, tagline: e.target.value })}
          />
        </label>
      </section>

      <section>
        <h2>Navigation</h2>
        <p>
          Rename, hide, or add links in the header. Links can be https:// URLs or paths like /about.
        </p>
        <div className="menu-item-card">
          <header>
            <strong>Discussions</strong>
            <MenuToggle
              label="Visible"
              checked={menu.discussions.visible}
              onChange={(visible) =>
                setMenu({ ...menu, discussions: { ...menu.discussions, visible } })
              }
            />
          </header>
          <label>
            <span>Label</span>
            <input
              value={menu.discussions.label}
              maxLength={40}
              onChange={(e) =>
                setMenu({ ...menu, discussions: { ...menu.discussions, label: e.target.value } })
              }
            />
          </label>
        </div>
        <div className="menu-item-card">
          <header>
            <strong>Resources</strong>
            <MenuToggle
              label="Visible"
              checked={menu.resources.visible}
              onChange={(visible) =>
                setMenu({ ...menu, resources: { ...menu.resources, visible } })
              }
            />
          </header>
          <div className="menu-item-fields">
            <label>
              <span>Label</span>
              <input
                value={menu.resources.label}
                maxLength={40}
                onChange={(e) =>
                  setMenu({ ...menu, resources: { ...menu.resources, label: e.target.value } })
                }
              />
            </label>
            <label>
              <span>URL</span>
              <input
                value={menu.resources.url}
                onChange={(e) =>
                  setMenu({ ...menu, resources: { ...menu.resources, url: e.target.value } })
                }
              />
            </label>
          </div>
        </div>
        <div className="menu-item-card">
          <header>
            <strong>Administration</strong>
            <MenuToggle
              label="Visible to admins"
              checked={menu.administration.visible}
              onChange={(visible) =>
                setMenu({ ...menu, administration: { ...menu.administration, visible } })
              }
            />
          </header>
          <label>
            <span>Label</span>
            <input
              value={menu.administration.label}
              maxLength={40}
              onChange={(e) =>
                setMenu({
                  ...menu,
                  administration: { ...menu.administration, label: e.target.value },
                })
              }
            />
          </label>
          <small className="admin-muted">
            Hidden or not, administrators can always open /admin directly.
          </small>
        </div>

        {menu.custom.map((item, index) => (
          <div className="menu-item-card" key={index}>
            <header>
              <strong>Custom link {index + 1}</strong>
              <span className="admin-row-actions">
                <MenuToggle
                  label="Visible"
                  checked={item.visible}
                  onChange={(visible) => updateCustom(index, { visible })}
                />
                <button
                  className="table-action danger-text"
                  type="button"
                  onClick={() =>
                    setMenu({
                      ...menu,
                      custom: menu.custom.filter((_, position) => position !== index),
                    })
                  }
                >
                  Remove
                </button>
              </span>
            </header>
            <div className="menu-item-fields">
              <label>
                <span>Label</span>
                <input
                  value={item.label}
                  maxLength={40}
                  onChange={(e) => updateCustom(index, { label: e.target.value })}
                />
              </label>
              <label>
                <span>URL</span>
                <input
                  value={item.url}
                  onChange={(e) => updateCustom(index, { url: e.target.value })}
                />
              </label>
            </div>
          </div>
        ))}
        <button
          className="button"
          type="button"
          disabled={menu.custom.length >= maxCustomHeaderLinks}
          onClick={() =>
            setMenu({
              ...menu,
              custom: [...menu.custom, { label: 'New link', url: '/', visible: true }],
            })
          }
        >
          Add custom link ({menu.custom.length}/{maxCustomHeaderLinks})
        </button>
      </section>
    </SettingsForm>
  );
}

function EmailForm({ settings }: { settings: CommunitySettings }) {
  const { busy, message, save } = useSettingsSave();
  const [mailDriver, setMailDriver] = useState(String(settings.mailDriver || 'smtp'));
  const [mailFrom, setMailFrom] = useState(String(settings.mailFrom || ''));
  const [mailHost, setMailHost] = useState(String(settings.mailHost || ''));
  const [mailPort, setMailPort] = useState(String(settings.mailPort || 587));

  return (
    <SettingsForm
      busy={busy}
      message={message}
      onSubmit={() => {
        const port = Number(mailPort);
        save(
          { mailDriver, mailFrom: mailFrom.trim(), mailHost: mailHost.trim(), mailPort: port },
          Number.isInteger(port) && port > 0 && port < 65536
            ? ''
            : 'Port must be between 1 and 65535.',
        );
      }}
    >
      <section>
        <h2>Delivery</h2>
        <p>
          Stored for the server integration. Account emails (confirmation, password reset) are sent
          by Supabase Auth and configured in the Supabase dashboard.
        </p>
        <label>
          <span>Mail driver</span>
          <select value={mailDriver} onChange={(e) => setMailDriver(e.target.value)}>
            <option value="smtp">SMTP</option>
            <option value="mailgun">Mailgun</option>
            <option value="postmark">Postmark</option>
            <option value="log">Log only</option>
          </select>
        </label>
        <label>
          <span>From address</span>
          <input
            type="email"
            value={mailFrom}
            onChange={(e) => setMailFrom(e.target.value)}
            placeholder="community@example.com"
          />
        </label>
        <div className="menu-item-fields">
          <label>
            <span>SMTP host</span>
            <input
              value={mailHost}
              onChange={(e) => setMailHost(e.target.value)}
              placeholder="smtp.example.com"
            />
          </label>
          <label>
            <span>Port</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={mailPort}
              onChange={(e) => setMailPort(e.target.value)}
            />
          </label>
        </div>
      </section>
    </SettingsForm>
  );
}

const panels = {
  basics: {
    eyebrow: 'Configuration',
    title: 'Community basics',
    copy: 'Name the community, set the welcome message, and control registration.',
    Form: BasicsForm,
  },
  appearance: {
    eyebrow: 'Configuration',
    title: 'Appearance',
    copy: 'Colors and display defaults applied across the community.',
    Form: AppearanceForm,
  },
  header: {
    eyebrow: 'Configuration',
    title: 'Header menu',
    copy: 'Brand and navigation links shown at the top of every page.',
    Form: HeaderForm,
  },
  email: {
    eyebrow: 'Configuration',
    title: 'Email',
    copy: 'Outgoing mail settings for community notifications.',
    Form: EmailForm,
  },
};

export function SettingsPanel({ panel }: { panel: keyof typeof panels }) {
  const { settings } = useAdminData();
  const { eyebrow, title, copy, Form } = panels[panel];
  return (
    <AdminPage>
      {() => (
        <>
          <PageHeading eyebrow={eyebrow} title={title} copy={copy} />
          <Form settings={settings} />
        </>
      )}
    </AdminPage>
  );
}
