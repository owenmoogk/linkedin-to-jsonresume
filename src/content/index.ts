/**
 * Exporter entry point. Injected into the LinkedIn page (MAIN world) by the
 * extension popup, and exposes `window.liToJr`.
 *
 * Can also be pasted into the browser console on a profile page, then used as
 * `await liToJr.showOutput()`.
 */
import { showModal } from './modal';
import type { ProfileData } from './profileData';
import { fetchProfileData } from './profileData';
import type { Resume, SchemaVersion } from './resume';
import { buildResume } from './resume';
import { promptDownload } from './utils';
import { downloadVCard } from './vcard';
import { VoyagerClient } from './voyager';

export interface LocaleInfo {
  /**
   * Locales the profile is available in, e.g. `['en_US', 'de_DE']`
   */
  supported: string[];
  /**
   * The viewer's own locale
   */
  user: string;
}

/**
 * How long fetched profile data is reused for (e.g. between the popup loading
 * locales and the user clicking export)
 */
const CACHE_TTL_MS = 60_000;

export class LinkedInExporter {
  private readonly cache = new Map<
    string,
    { data: Promise<ProfileData>; fetchedAt: number }
  >();

  private readonly debug = window.location.href.includes('li2jr_debug=true');

  /**
   * Public profile ID from the URL (`linkedin.com/in/<id>/...`)
   */
  getProfileId(): string {
    const match = /linkedin\.com\/in\/([^/?#]+)/i.exec(window.location.href);
    if (!match?.[1]) {
      throw new Error('Not on a LinkedIn profile page (linkedin.com/in/...)');
    }
    return decodeURIComponent(match[1]);
  }

  getProfileUrl(): string {
    return `https://www.linkedin.com/in/${this.getProfileId()}/`;
  }

  /**
   * The viewer's own locale, as set in LinkedIn
   */
  getViewerLocale(): string {
    const meta = document.querySelector('meta[name="i18nDefaultLocale"]');
    const select = document.querySelector<HTMLSelectElement>(
      'select#globalfooter-select_language'
    );
    return meta?.getAttribute('content') ?? select?.value ?? 'en_US';
  }

  /**
   * Fetch (or reuse cached) profile data for the current page
   * @param locale Profile locale to request; omit for the profile's default
   */
  async getProfileData(locale?: string | null): Promise<ProfileData> {
    const publicId = this.getProfileId();
    const requestedLocale =
      locale && locale !== this.getViewerLocale() ? locale : null;
    const key = `${publicId}|${requestedLocale ?? ''}`;

    const cached = this.cache.get(key);
    let data = cached?.data;
    if (!data || !cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
      data = fetchProfileData(new VoyagerClient(requestedLocale), publicId);
      this.cache.set(key, { data, fetchedAt: Date.now() });
      // Don't cache failures
      data.catch(() => this.cache.delete(key));
    }

    const result = await data;
    if (this.debug) console.warn('[li2jr] profile data', result);
    for (const warning of result.warnings) console.warn(`[li2jr] ${warning}`);
    return result;
  }

  async getLocales(): Promise<LocaleInfo> {
    const user = this.getViewerLocale();
    const { profile } = await this.getProfileData();
    const supported = (profile.supportedLocales ?? []).map(
      (l) => `${l.language}_${l.country}`
    );
    return { supported, user };
  }

  async getResume(
    version: SchemaVersion = 'stable',
    locale?: string | null
  ): Promise<Resume> {
    return buildResume(await this.getProfileData(locale), version);
  }

  async showOutput(
    version: SchemaVersion = 'stable',
    locale?: string | null
  ): Promise<void> {
    const resume = await this.getResume(version, locale);
    showModal(JSON.stringify(resume, null, 2));
  }

  async download(
    version: SchemaVersion = 'stable',
    locale?: string | null
  ): Promise<void> {
    const resume = await this.getResume(version, locale);
    const name = resume.basics?.name ?? this.getProfileId();
    promptDownload(
      JSON.stringify(resume, null, 2),
      `${name.replace(/\s/g, '_')}.resume.json`,
      'application/json'
    );
  }

  async downloadVCard(locale?: string | null): Promise<void> {
    await downloadVCard(
      await this.getProfileData(locale),
      this.getProfileUrl()
    );
  }
}

declare global {
  interface Window {
    liToJr?: LinkedInExporter;
  }
}

// Reuse an existing instance (and its cache) if the script is injected again
window.liToJr ??= new LinkedInExporter();
