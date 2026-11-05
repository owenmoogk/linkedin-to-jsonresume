import type {
  LiCompany,
  LiGeo,
  LiLanguage,
  LiMiniProfile,
  LiPosition,
  LiUrn,
} from './linkedin';
import type { ProfileData } from './profileData';
import {
  formatDateRange,
  formatStartDate,
  restoreParagraphBreaks,
} from './utils';
import type {
  Certificate,
  Language,
  Profile,
  ResumeSchemaStable,
} from '../schema/jsonresume.schema.latest';
import type { ResumeSchemaLegacy } from '../schema/jsonresume.schema.legacy';

export type SchemaVersion = 'legacy' | 'stable' | 'beta';

/**
 * Certificates also carry start/end dates (beyond the v1.0.0 spec, which only
 * has `date`), matching what this tool has always exported
 */
export type ExportCertificate = Certificate & {
  startDate?: string;
  endDate?: string;
};

export type StableResume = Omit<ResumeSchemaStable, 'certificates'> & {
  $schema: string;
  certificates: ExportCertificate[];
};

export type Resume = StableResume | ResumeSchemaLegacy;

const LANGUAGE_PROFICIENCY: Record<string, string> = {
  NATIVE_OR_BILINGUAL: 'Native Speaker',
  FULL_PROFESSIONAL: 'Full Professional',
  EXPERT: 'Expert',
  ADVANCED: 'Advanced',
  PROFESSIONAL_WORKING: 'Professional Working',
  LIMITED_WORKING: 'Limited Working',
  INTERMEDIATE: 'intermediate',
  BEGINNER: 'Beginner',
  ELEMENTARY: 'Elementary',
};

function str(value: string | null | undefined): string {
  return value ?? '';
}

export function buildResume(data: ProfileData, version: SchemaVersion): Resume {
  const stable = buildStableResume(data);
  // Beta is currently even with stable (v1.0.0)
  return version === 'legacy' ? toLegacy(stable) : stable;
}

export function buildStableResume(data: ProfileData): StableResume {
  const { profile, store, contactInfo } = data;

  const geoName = (urn: LiUrn | undefined) =>
    str(store.get<LiGeo>(urn)?.defaultLocalizedName);
  const companyUrl = (urn: LiUrn | undefined) =>
    str(store.get<LiCompany>(urn)?.url);

  // Basics
  const publicId = str(profile.publicIdentifier);
  const profiles: Profile[] = [
    {
      network: 'LinkedIn',
      username: publicId,
      url: `https://www.linkedin.com/in/${publicId}/`,
    },
  ];
  for (const handle of contactInfo?.twitterHandles ?? []) {
    if (handle.name) {
      profiles.push({
        network: 'Twitter',
        username: handle.name,
        url: `https://twitter.com/${handle.name}`,
      });
    }
  }

  // Prefer portfolio, then personal, then any website
  const websites = contactInfo?.websites ?? [];
  const website = [/portfolio/i, /personal/i, /.*/]
    .map((patt) => websites.find((w) => w.url && patt.test(str(w.category))))
    .find((w) => w !== undefined)?.url;

  const work = data.positions.map((position: LiPosition) => ({
    name: str(position.companyName).trim(),
    position: str(position.title).trim(),
    ...formatDateRange(position.dateRange),
    highlights: [],
    summary: str(position.description),
    url: companyUrl(position.companyUrn),
    // Prefer the full geo name (e.g. "Augsburg, Bavaria, Germany") over the
    // user-entered location text, when LinkedIn includes it
    location:
      geoName(position.geoUrn) ||
      str(position.geoLocationName) ||
      str(position.locationName),
  }));

  const education = data.educations.map((edu) => ({
    institution: str(edu.schoolName),
    area: str(edu.fieldOfStudy),
    studyType: str(edu.degreeName),
    ...formatDateRange(edu.dateRange),
    score: str(edu.grade),
    courses: data.courses
      .filter((c) => c.occupationUnion?.profileEducation === edu.entityUrn)
      .map((c) => `${str(c.number)} - ${str(c.name)}`),
  }));

  const volunteer = data.volunteerExperiences.map((v) => ({
    organization: str(v.companyName),
    position: str(v.role),
    url: companyUrl(v.companyUrn),
    ...formatDateRange(v.dateRange),
    summary: str(v.description),
    highlights: [],
  }));

  const certificates = data.certifications.map((cert) => {
    const { startDate, endDate } = formatDateRange(cert.dateRange);
    const out: ExportCertificate = {
      name: str(cert.name),
      issuer: str(cert.authority),
    };
    if (startDate) out.startDate = startDate;
    if (endDate) out.endDate = endDate;
    if (cert.url) out.url = cert.url;
    return out;
  });

  const awards = data.honors.map((honor) => ({
    title: str(honor.title),
    date: formatStartDate(honor.issuedOn),
    awarder: str(honor.issuer),
    summary: str(honor.description),
  }));

  const publications = data.publications.map((pub) => ({
    name: str(pub.name),
    publisher: str(pub.publisher),
    releaseDate: formatStartDate(pub.publishedOn),
    url: str(pub.url),
    summary: str(pub.description),
  }));

  const projects = data.projects.map((project) => ({
    name: str(project.title),
    ...formatDateRange(project.dateRange),
    summary: str(project.description),
    url: str(project.url),
  }));

  const skillNames = [
    ...new Set(data.skills.map((s) => str(s.name)).filter(Boolean)),
  ];

  const references = data.recommendations.map((rec) => {
    const recommender = store.get<LiMiniProfile>(rec['*recommender']);
    return {
      name: `${str(recommender?.firstName)} ${str(recommender?.lastName)}`.trim(),
      reference: str(rec.recommendationText),
    };
  });

  return {
    $schema:
      'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: `${profile.firstName} ${profile.lastName}`,
      label: str(profile.headline),
      image: '',
      email: str(contactInfo?.emailAddress?.emailAddress),
      phone: str(
        contactInfo?.phoneNumbers?.find((p) => p.phoneNumber?.number)
          ?.phoneNumber?.number
      ),
      url: str(website),
      summary: restoreParagraphBreaks(str(profile.summary)),
      location: {
        countryCode: str(
          profile.location?.countryCode ?? profile.primaryLocale?.country
        ),
        address:
          str(profile.address) ||
          geoName(profile.geoLocation?.geoUrn) ||
          str(profile.locationName),
      },
      profiles,
    },
    work,
    volunteer,
    education,
    awards,
    certificates,
    publications,
    skills: skillNames.map((name) => ({ name, level: '', keywords: [] })),
    languages: buildLanguages(data.profile.primaryLocale, data.languages),
    interests: [],
    references,
    projects,
    meta: {
      version: 'v1.0.0',
      canonical:
        'https://github.com/jsonresume/resume-schema/blob/v1.0.0/schema.json',
    },
  };
}

/**
 * Profile's primary language (as native), plus any listed languages with a
 * proficiency
 */
function buildLanguages(
  primaryLocale: ProfileData['profile']['primaryLocale'],
  liLanguages: LiLanguage[]
): Language[] {
  const listed: Language[] = [];
  for (const lang of liLanguages) {
    const fluency = LANGUAGE_PROFICIENCY[str(lang.proficiency).toUpperCase()];
    if (fluency && lang.name) listed.push({ language: lang.name, fluency });
  }

  const languages: Language[] = [];
  if (primaryLocale) {
    const primary =
      primaryLocale.language.toLowerCase() === 'en'
        ? 'English'
        : primaryLocale.language;
    if (!listed.some((l) => l.language === primary)) {
      languages.push({ language: primary, fluency: 'Native Speaker' });
    }
  }
  return [...languages, ...listed];
}

/**
 * Convert to the legacy (v0.0.16) schema shape
 */
export function toLegacy(resume: StableResume): ResumeSchemaLegacy {
  const { basics } = resume;
  return {
    basics: {
      name: str(basics?.name),
      label: str(basics?.label),
      picture: str(basics?.image),
      email: str(basics?.email),
      phone: str(basics?.phone),
      website: str(basics?.url),
      summary: str(basics?.summary),
      location: basics?.location ?? {},
      profiles: basics?.profiles ?? [],
    },
    work: (resume.work ?? []).map((w) => ({
      company: str(w.name),
      position: str(w.position),
      website: str(w.url),
      startDate: str(w.startDate),
      endDate: str(w.endDate),
      summary: str(w.summary),
      highlights: w.highlights ?? [],
    })),
    volunteer: (resume.volunteer ?? []).map(({ url, ...rest }) => ({
      ...rest,
      website: str(url),
    })),
    education: (resume.education ?? []).map((e) => ({
      institution: str(e.institution),
      area: str(e.area),
      studyType: str(e.studyType),
      startDate: str(e.startDate),
      endDate: str(e.endDate),
      gpa: str(e.score),
      courses: e.courses ?? [],
    })),
    awards: resume.awards ?? [],
    publications: (resume.publications ?? []).map(({ url, ...rest }) => ({
      ...rest,
      website: str(url),
    })),
    skills: resume.skills ?? [],
    languages: resume.languages ?? [],
    interests: resume.interests ?? [],
    references: resume.references ?? [],
  };
}
