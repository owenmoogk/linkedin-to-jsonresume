/**
 * Extension popup (Manifest V3; Firefox and Chrome).
 *
 * The exporter (`exporter.js`) is injected into the page's MAIN world so that it
 * shares the page's origin and session cookies (needed for LinkedIn's internal
 * API), then driven through `window.liToJr` with `scripting.executeScript`.
 */
import type { LocaleInfo } from '../content/index';
import type { SchemaVersion } from '../content/resume';

const STORAGE_KEYS = {
  schemaVersion: 'schemaVersion',
} as const;
const SCHEMA_VERSIONS: readonly SchemaVersion[] = ['legacy', 'stable', 'beta'];
const PROFILE_URL_PATTERN = /^https:\/\/www\.linkedin\.com\/in\//;

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Missing #${id}`);
  return el;
}

const specSelect = getElement('specSelect', HTMLSelectElement);
const langSelect = getElement('langSelect', HTMLSelectElement);
const statusEl = getElement('status', HTMLSpanElement);

function isSchemaVersion(value: unknown): value is SchemaVersion {
  return SCHEMA_VERSIONS.some((v) => v === value);
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function setEnabled(enabled: boolean): void {
  document.querySelectorAll('.toggle').forEach((el) => {
    el.classList.toggle('enabled', enabled);
    el.classList.toggle('disabled', !enabled);
  });
}

async function getActiveProfileTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id !== undefined && PROFILE_URL_PATTERN.test(tab.url ?? '')
    ? tab.id
    : undefined;
}

/**
 * Run a function in the page (MAIN world). `func` is serialized, so it can't
 * close over anything from this file; pass values through `args`.
 */
async function runInPage<Args extends unknown[], Result>(
  tabId: number,
  func: (...args: Args) => Result,
  args: Args
): Promise<Awaited<Result>> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func,
    args,
  });
  // Firefox reports errors thrown in the page on the result
  const { error } = (result ?? {}) as { error?: unknown };
  if (error) {
    throw error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
  return result?.result as Awaited<Result>;
}

async function ensureExporter(tabId: number): Promise<void> {
  const loaded = await runInPage(tabId, () => window.liToJr !== undefined, []);
  if (!loaded) {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['exporter.js'],
    });
  }
}

async function getSchemaVersion(): Promise<SchemaVersion> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.schemaVersion);
    const value = stored[STORAGE_KEYS.schemaVersion];
    if (isSchemaVersion(value)) return value;
  } catch (err) {
    console.error(err);
  }
  return isSchemaVersion(specSelect.value) ? specSelect.value : 'stable';
}

function loadLocales({ supported, user }: LocaleInfo): void {
  langSelect.replaceChildren(
    ...[user, ...supported.filter((l) => l !== user)].map((locale) => {
      const option = document.createElement('option');
      option.value = locale;
      option.textContent = locale;
      return option;
    })
  );
}

/**
 * Wire a button to an action, with status + error reporting
 */
function onClick(
  id: string,
  action: (tabId: number) => Promise<void>,
  closeAfter = false
): void {
  getElement(id, HTMLButtonElement).addEventListener('click', () => {
    void (async () => {
      const tabId = await getActiveProfileTabId();
      if (tabId === undefined) return;
      setStatus('Working… (this can take a few seconds)');
      try {
        await ensureExporter(tabId);
        await action(tabId);
        setStatus('');
        if (closeAfter) window.close();
      } catch (err) {
        console.error(err);
        setStatus(`Error: ${errorMessage(err)}`);
      }
    })();
  });
}

onClick(
  'showButton',
  async (tabId) => {
    await runInPage(
      tabId,
      async (version: SchemaVersion, locale: string) =>
        window.liToJr?.showOutput(version, locale),
      [await getSchemaVersion(), langSelect.value]
    );
  },
  true
);

onClick('downloadButton', async (tabId) => {
  await runInPage(
    tabId,
    async (version: SchemaVersion, locale: string) =>
      window.liToJr?.download(version, locale),
    [await getSchemaVersion(), langSelect.value]
  );
});

onClick('vcardButton', async (tabId) => {
  await runInPage(
    tabId,
    async (locale) => window.liToJr?.downloadVCard(locale),
    [langSelect.value]
  );
});

specSelect.addEventListener('change', () => {
  if (isSchemaVersion(specSelect.value)) {
    void chrome.storage.local.set({
      [STORAGE_KEYS.schemaVersion]: specSelect.value,
    });
  }
});

async function init(): Promise<void> {
  getElement('versionDisplay', HTMLSpanElement).textContent =
    chrome.runtime.getManifest().version;
  specSelect.value = await getSchemaVersion();

  const tabId = await getActiveProfileTabId();
  if (tabId === undefined) {
    setEnabled(false);
    setStatus('Open a LinkedIn profile page (linkedin.com/in/…) to use this.');
    return;
  }

  setEnabled(true);
  try {
    await ensureExporter(tabId);
    const locales = await runInPage(
      tabId,
      async () => window.liToJr?.getLocales(),
      []
    );
    if (locales) loadLocales(locales);
  } catch (err) {
    console.error(err);
    setStatus(`Error loading exporter: ${errorMessage(err)}`);
  }
}

void init();
