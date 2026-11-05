import vCardsJS from '@dan/vcards';

import type { ProfileData } from './profileData';
import { liDateToJsDate, promptDownload, urlToBase64 } from './utils';

/**
 * Smallest available rendition of the profile photo
 */
function getProfilePhotoUrl(data: ProfileData): string | undefined {
  const image = data.profile.profilePicture?.displayImageReference?.vectorImage;
  if (!image) return undefined;
  const smallest = [...image.artifacts].sort((a, b) => a.width - b.width)[0];
  return smallest
    ? image.rootUrl + smallest.fileIdentifyingUrlPathSegment
    : undefined;
}

export async function downloadVCard(
  data: ProfileData,
  profileUrl: string
): Promise<void> {
  const { profile, contactInfo } = data;
  const vCard = vCardsJS();

  vCard.formattedName = `${profile.firstName} ${profile.lastName}`;
  vCard.firstName = profile.firstName;
  vCard.lastName = profile.lastName;

  const postalCode =
    profile.geoLocation?.postalCode ?? profile.location?.postalCode;
  if (postalCode) vCard.homeAddress.postalCode = postalCode;

  const email = contactInfo?.emailAddress?.emailAddress;
  if (email) vCard.email = email;

  const twitter = contactInfo?.twitterHandles?.[0]?.name;
  if (twitter) vCard.socialUrls.twitter = `https://twitter.com/${twitter}`;

  for (const phone of contactInfo?.phoneNumbers ?? []) {
    const number = phone.phoneNumber?.number;
    if (!number) continue;
    if (phone.type === 'MOBILE') vCard.cellPhone = number;
    else if (phone.type === 'WORK') vCard.workPhone = number;
    else vCard.homePhone = number;
  }

  // vCard v3 can't represent a birthday without a year, so it's omitted then
  const birthday = profile.birthDateOn;
  if (birthday?.year && birthday.month && birthday.day) {
    vCard.birthday = liDateToJsDate(birthday);
  }

  const currentPosition = data.positions[0];
  if (currentPosition) {
    vCard.organization = currentPosition.companyName ?? '';
    vCard.title = currentPosition.title ?? '';
  }
  vCard.workUrl = profileUrl;
  vCard.note = profile.headline ?? '';

  // LinkedIn photo URLs expire, so embed the image instead of linking it
  const photoUrl = getProfilePhotoUrl(data);
  if (photoUrl) {
    try {
      const { base64, mimeType } = await urlToBase64(photoUrl);
      vCard.photo.embedFromString(base64, mimeType);
    } catch (err) {
      console.warn('Could not embed profile photo in vCard', err);
    }
  }

  promptDownload(
    vCard.getFormattedString(),
    `${profile.firstName}_${profile.lastName}.vcf`,
    'text/vcard'
  );
}
