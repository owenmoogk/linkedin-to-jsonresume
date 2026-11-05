import type { LiResponse } from './linkedin';
import { isPagingComplete } from './linkedin';
import { getCookie, remapNestedLocale, setQueryParams } from './utils';

const VOYAGER_BASE = 'https://www.linkedin.com/voyager/api';

/**
 * Voyager (Dash) endpoints.
 * Note: the legacy `/identity/profiles/{id}/*` endpoints were retired by
 * LinkedIn (HTTP 410), so only Dash endpoints are used.
 */
export const ENDPOINTS = {
  fullProfile: (publicId: string) =>
    `/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(publicId)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93`,
  contactInfo: (publicId: string) =>
    `/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(publicId)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.ProfileContactInfo-17`,
  positionGroups: (profileUrn: string) =>
    `/identity/dash/profilePositionGroups?q=viewee&profileUrn=${encodeURIComponent(profileUrn)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfilePositionGroup-50`,
  skills: (profileUrn: string) =>
    `/identity/dash/profileSkills?q=viewee&profileUrn=${encodeURIComponent(profileUrn)}`,
  volunteerExperiences: (profileUrn: string) =>
    `/identity/dash/profileVolunteerExperiences?q=viewee&profileUrn=${encodeURIComponent(profileUrn)}`,
  recommendations: (profileUrn: string) =>
    `/identity/dash/recommendations?q=received&profileUrn=${encodeURIComponent(profileUrn)}&recommendationStatuses=List(VISIBLE)`,
};

const MAX_PAGES = 20;

export class VoyagerClient {
  /**
   * @param locale Requested profile locale (e.g. `de_DE`), or null for the
   *   profile's default
   */
  constructor(private readonly locale: string | null) {}

  /**
   * Authenticated fetch against the internal API, using the page's session
   */
  async fetch(path: string): Promise<LiResponse> {
    const csrfToken = getCookie('JSESSIONID')?.replace(/"/g, '');
    if (!csrfToken) {
      throw new Error(
        'Could not find LinkedIn session cookie. Are you signed in?'
      );
    }

    const headers: Record<string, string> = {
      accept: 'application/vnd.linkedin.normalized+json+2.1',
      'csrf-token': csrfToken,
    };
    if (this.locale) headers['x-li-lang'] = this.locale;

    const url = path.startsWith('https') ? path : VOYAGER_BASE + path;
    const res = await fetch(url, { credentials: 'include', headers });
    if (!res.ok) {
      throw new Error(
        `LinkedIn API request failed (${res.status.toString()}): ${url}`
      );
    }

    const json = (await res.json()) as LiResponse;
    if (this.locale) remapNestedLocale(json.included, this.locale);
    return json;
  }

  /**
   * Fetch all pages of a paginated collection endpoint
   */
  async fetchAllPages(path: string, pageSize = 50): Promise<LiResponse[]> {
    const url = VOYAGER_BASE + path;
    const pages: LiResponse[] = [];
    let start = 0;

    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await this.fetch(
        setQueryParams(url, { start, count: pageSize })
      );
      pages.push(page);
      const { paging } = page.data;
      if (!paging || isPagingComplete(paging)) break;
      start = paging.start + paging.count;
    }

    return pages;
  }
}
