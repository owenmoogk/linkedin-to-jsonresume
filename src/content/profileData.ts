import type {
  LiCertification,
  LiContactInfo,
  LiCourse,
  LiEducation,
  LiEntity,
  LiHonor,
  LiLanguage,
  LiPosition,
  LiPositionGroup,
  LiProfile,
  LiProject,
  LiPublication,
  LiRecommendation,
  LiResponse,
  LiSkill,
  LiUrn,
  LiVolunteerExperience,
  ProfileCollectionKey,
} from './linkedin';
import { EntityStore, LI_TYPES } from './linkedin';
import type { VoyagerClient } from './voyager';
import { ENDPOINTS } from './voyager';

/**
 * Everything fetched for one profile, with entity references still resolvable
 * through `store`
 */
export interface ProfileData {
  profile: LiProfile;
  store: EntityStore;
  positions: LiPosition[];
  educations: LiEducation[];
  courses: LiCourse[];
  volunteerExperiences: LiVolunteerExperience[];
  certifications: LiCertification[];
  honors: LiHonor[];
  projects: LiProject[];
  publications: LiPublication[];
  languages: LiLanguage[];
  skills: LiSkill[];
  recommendations: LiRecommendation[];
  contactInfo: LiContactInfo | undefined;
  /**
   * Sections that LinkedIn truncated and that could not be fetched in full
   */
  warnings: string[];
}

function elementUrns(response: LiResponse): LiUrn[] {
  return response.data['*elements'] ?? [];
}

/**
 * Fetch and assemble all profile data for a public profile ID (the `<id>` in
 * `linkedin.com/in/<id>`)
 */
export async function fetchProfileData(
  client: VoyagerClient,
  publicId: string
): Promise<ProfileData> {
  const store = new EntityStore();
  const warnings: string[] = [];

  const fullProfileRes = await client.fetch(ENDPOINTS.fullProfile(publicId));
  store.addResponse(fullProfileRes);
  const profile = store.get<LiProfile>(elementUrns(fullProfileRes)[0]);
  if (!profile?.firstName) {
    throw new Error('Could not find profile in LinkedIn API response');
  }
  const profileUrn = profile.entityUrn;

  /**
   * Items of a collection embedded in the full profile response. If LinkedIn
   * truncated it, re-fetch all pages from `fallbackPath` (if there is one).
   */
  const getSection = async <T extends LiEntity>(
    key: ProfileCollectionKey,
    fallback?: { path: string; type: string }
  ): Promise<T[]> => {
    const { items, complete } = store.collection<T>(profile[key]);
    if (complete) return items;

    if (fallback) {
      try {
        const pages = await client.fetchAllPages(fallback.path);
        const fetched = new EntityStore();
        for (const page of pages) {
          store.addResponse(page);
          fetched.addResponse(page);
        }
        return fetched.ofType<T>(fallback.type);
      } catch (err) {
        console.warn(`Could not fetch full ${key}`, err);
      }
    }
    warnings.push(`${key.replace('*profile', '')} may be incomplete`);
    return items;
  };

  // Positions: always fetched from their own endpoint, since the full profile
  // only includes the first few position groups
  const positionPages = await client.fetchAllPages(
    ENDPOINTS.positionGroups(profileUrn)
  );
  for (const page of positionPages) store.addResponse(page);
  const positions = positionPages
    .flatMap((page) => store.getMany<LiPositionGroup>(elementUrns(page)))
    .flatMap(
      (group) =>
        store.collection<LiPosition>(group['*profilePositionInPositionGroup'])
          .items
    );

  const [contactInfo, recommendations] = await Promise.all([
    fetchContactInfo(client, publicId),
    fetchRecommendations(client, store, profileUrn),
  ]);

  return {
    profile,
    store,
    positions,
    educations: await getSection<LiEducation>('*profileEducations'),
    courses: await getSection<LiCourse>('*profileCourses'),
    volunteerExperiences: await getSection<LiVolunteerExperience>(
      '*profileVolunteerExperiences',
      {
        path: ENDPOINTS.volunteerExperiences(profileUrn),
        type: LI_TYPES.volunteerExperience,
      }
    ),
    certifications: await getSection<LiCertification>('*profileCertifications'),
    honors: await getSection<LiHonor>('*profileHonors'),
    projects: await getSection<LiProject>('*profileProjects'),
    publications: await getSection<LiPublication>('*profilePublications'),
    languages: await getSection<LiLanguage>('*profileLanguages'),
    skills: await getSection<LiSkill>('*profileSkills', {
      path: ENDPOINTS.skills(profileUrn),
      type: LI_TYPES.skill,
    }),
    recommendations,
    contactInfo,
    warnings,
  };
}

async function fetchContactInfo(
  client: VoyagerClient,
  publicId: string
): Promise<LiContactInfo | undefined> {
  try {
    const res = await client.fetch(ENDPOINTS.contactInfo(publicId));
    // Kept out of the main store: this is a different "view" of the profile
    // entity, with the same URN
    const contactStore = new EntityStore();
    contactStore.addResponse(res);
    return contactStore
      .ofType<LiContactInfo>(LI_TYPES.profile)
      .find((p) => !p.publicIdentifier || p.publicIdentifier === publicId);
  } catch (err) {
    console.warn('Could not fetch contact info', err);
    return undefined;
  }
}

async function fetchRecommendations(
  client: VoyagerClient,
  store: EntityStore,
  profileUrn: string
): Promise<LiRecommendation[]> {
  try {
    const res = await client.fetch(ENDPOINTS.recommendations(profileUrn));
    store.addResponse(res);
    return store
      .getMany<LiRecommendation>(elementUrns(res))
      .filter((r) => !!r.recommendationText);
  } catch (err) {
    console.warn('Could not fetch recommendations', err);
    return [];
  }
}
