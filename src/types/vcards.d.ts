declare module '@dan/vcards' {
  interface VCardAddress {
    label: string;
    street: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    countryRegion: string;
  }

  interface VCardPhoto {
    attachFromUrl: (url: string, mediaType: string) => void;
    embedFromString: (base64: string, mediaType: string) => void;
  }

  interface VCard {
    formattedName: string;
    firstName: string;
    lastName: string;
    email: string | string[];
    cellPhone: string | string[];
    workPhone: string | string[];
    homePhone: string | string[];
    birthday: Date | string;
    organization: string;
    title: string;
    url: string;
    workUrl: string;
    note: string;
    homeAddress: VCardAddress;
    photo: VCardPhoto;
    socialUrls: Record<string, string>;
    getFormattedString: () => string;
  }

  export default function vCardsJS(): VCard;
}
