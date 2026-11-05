/**
 * Types + helpers for LinkedIn's internal "Voyager" API (Dash endpoints).
 *
 * Voyager responses are "normalized": `data` points at the requested entity (or a
 * collection of URNs), and every referenced entity is listed flat in `included`.
 * References between entities are stored under keys prefixed with `*`.
 */

/**
 * Uniform Resource Name, e.g. `urn:li:fsd_profile:ACoAAD...`
 */
export type LiUrn = string;

/**
 * Month and day are *not* zero-indexed (February is `2`)
 */
export interface LiDate {
  year?: number;
  month?: number;
  day?: number;
}

export interface LiDateRange {
  start?: LiDate;
  end?: LiDate;
}

export interface LiLocale {
  language: string;
  country: string;
}

export interface LiPaging {
  start: number;
  count: number;
  total?: number;
}

export interface LiEntity {
  $type: string;
  entityUrn: LiUrn;
}

export interface LiCollection extends LiEntity {
  paging?: LiPaging;
  '*elements'?: LiUrn[];
}

export interface LiResponse {
  data: Partial<LiCollection>;
  included: LiEntity[];
}

export interface LiVectorImage {
  rootUrl: string;
  artifacts: { width: number; fileIdentifyingUrlPathSegment: string }[];
}

export type ProfileCollectionKey =
  | '*profileCertifications'
  | '*profileCourses'
  | '*profileEducations'
  | '*profileHonors'
  | '*profileLanguages'
  | '*profilePositionGroups'
  | '*profileProjects'
  | '*profilePublications'
  | '*profileSkills'
  | '*profileVolunteerExperiences';

export interface LiProfile
  extends LiEntity, Partial<Record<ProfileCollectionKey, LiUrn>> {
  firstName: string;
  lastName: string;
  publicIdentifier?: string;
  headline?: string | null;
  summary?: string | null;
  address?: string | null;
  locationName?: string | null;
  geoLocation?: { geoUrn?: LiUrn; postalCode?: string } | null;
  location?: { countryCode?: string; postalCode?: string } | null;
  primaryLocale?: LiLocale;
  supportedLocales?: LiLocale[];
  birthDateOn?: LiDate | null;
  profilePicture?: {
    displayImageReference?: { vectorImage?: LiVectorImage };
  } | null;
}

export interface LiContactInfo extends LiEntity {
  publicIdentifier?: string;
  address?: string | null;
  emailAddress?: { emailAddress?: string } | null;
  phoneNumbers?: { phoneNumber?: { number?: string }; type?: string }[] | null;
  websites?: { url?: string; category?: string }[] | null;
  twitterHandles?: { name?: string }[] | null;
}

export interface LiGeo extends LiEntity {
  defaultLocalizedName?: string;
}

export interface LiCompany extends LiEntity {
  url?: string;
}

export interface LiPositionGroup extends LiEntity {
  '*profilePositionInPositionGroup'?: LiUrn;
}

export interface LiPosition extends LiEntity {
  title?: string | null;
  companyName?: string | null;
  companyUrn?: LiUrn;
  description?: string | null;
  dateRange?: LiDateRange | null;
  locationName?: string | null;
  geoLocationName?: string | null;
  geoUrn?: LiUrn;
}

export interface LiEducation extends LiEntity {
  schoolName?: string | null;
  fieldOfStudy?: string | null;
  degreeName?: string | null;
  grade?: string | null;
  dateRange?: LiDateRange | null;
}

export interface LiCourse extends LiEntity {
  name?: string;
  number?: string;
  occupationUnion?: { profileEducation?: LiUrn };
}

export interface LiVolunteerExperience extends LiEntity {
  companyName?: string | null;
  companyUrn?: LiUrn;
  role?: string | null;
  description?: string | null;
  dateRange?: LiDateRange | null;
}

export interface LiCertification extends LiEntity {
  name?: string;
  authority?: string;
  url?: string | null;
  dateRange?: LiDateRange | null;
}

export interface LiHonor extends LiEntity {
  title?: string;
  issuer?: string;
  description?: string | null;
  issuedOn?: LiDate | null;
}

export interface LiProject extends LiEntity {
  title?: string;
  description?: string | null;
  url?: string | null;
  dateRange?: LiDateRange | null;
}

export interface LiPublication extends LiEntity {
  name?: string;
  publisher?: string;
  description?: string | null;
  url?: string | null;
  publishedOn?: LiDate | null;
}

export interface LiLanguage extends LiEntity {
  name?: string;
  proficiency?: string | null;
}

export interface LiSkill extends LiEntity {
  name?: string;
}

export interface LiRecommendation extends LiEntity {
  recommendationText?: string;
  '*recommender'?: LiUrn;
}

export interface LiMiniProfile extends LiEntity {
  firstName?: string;
  lastName?: string;
}

/**
 * Flat lookup of every entity seen across one or more Voyager responses
 */
export class EntityStore {
  private readonly byUrn = new Map<LiUrn, LiEntity>();

  /**
   * Add all `included` entities of a response.
   * If an entity was already seen, fields are merged, keeping existing values:
   * some endpoints return "thinner" copies of the same entity (e.g. a Geo
   * without its name), which shouldn't clobber a richer one.
   */
  addResponse(response: LiResponse): void {
    for (const entity of response.included) {
      const existing = this.byUrn.get(entity.entityUrn);
      this.byUrn.set(
        entity.entityUrn,
        existing ? { ...entity, ...existing } : entity
      );
    }
  }

  // Entities come from LinkedIn's JSON, so `T` is effectively a cast at this
  // trust boundary: the caller states which entity type a reference points to
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  get<T extends LiEntity>(urn: LiUrn | null | undefined): T | undefined {
    return urn ? (this.byUrn.get(urn) as T | undefined) : undefined;
  }

  getMany<T extends LiEntity>(urns: readonly LiUrn[] | undefined): T[] {
    return (urns ?? [])
      .map((urn) => this.get<T>(urn))
      .filter((e): e is T => e !== undefined);
  }

  ofType<T extends LiEntity>(type: string): T[] {
    return [...this.byUrn.values()].filter((e): e is T => e.$type === type);
  }

  /**
   * Resolve a collection reference (e.g. `profile['*profileEducations']`)
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  collection<T extends LiEntity>(
    urn: LiUrn | undefined
  ): { items: T[]; complete: boolean } {
    const coll = this.get<LiCollection>(urn);
    if (!coll) return { items: [], complete: true };
    return {
      items: this.getMany<T>(coll['*elements']),
      complete: isPagingComplete(coll.paging),
    };
  }
}

export function isPagingComplete(paging: LiPaging | undefined): boolean {
  if (paging?.total === undefined) return true;
  return paging.start + paging.count >= paging.total;
}

export const LI_TYPES = {
  profile: 'com.linkedin.voyager.dash.identity.profile.Profile',
  course: 'com.linkedin.voyager.dash.identity.profile.Course',
  volunteerExperience:
    'com.linkedin.voyager.dash.identity.profile.VolunteerExperience',
  skill: 'com.linkedin.voyager.dash.identity.profile.Skill',
} as const;
