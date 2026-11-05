import type { LiDate, LiDateRange } from './linkedin';

const MAX_DAYS_OF_MONTH: Record<number, number> = {
  1: 31,
  2: 28,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
  7: 31,
  8: 31,
  9: 30,
  10: 31,
  11: 30,
  12: 31,
};

function zeroLeftPad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Format a LinkedIn date as `YYYY-MM-DD`.
 * Missing month / day default to the start (or end, if `isStart` is false) of
 * the year / month.
 */
function formatLiDate(date: LiDate | null | undefined, isStart: boolean) {
  if (date?.year === undefined) return '';
  const month = date.month ?? (isStart ? 1 : 12);
  const day = date.day ?? (isStart ? 1 : (MAX_DAYS_OF_MONTH[month] ?? 31));
  return `${date.year.toString()}-${zeroLeftPad(month)}-${zeroLeftPad(day)}`;
}

export function formatStartDate(date: LiDate | null | undefined): string {
  return formatLiDate(date, true);
}

export function formatEndDate(date: LiDate | null | undefined): string {
  return formatLiDate(date, false);
}

export function formatDateRange(range: LiDateRange | null | undefined): {
  startDate: string;
  endDate: string;
} {
  return {
    startDate: formatStartDate(range?.start),
    endDate: formatEndDate(range?.end),
  };
}

/**
 * Convert a LinkedIn date to a JS Date, without a timezone offset
 */
export function liDateToJsDate(date: LiDate): Date {
  return new Date(`${formatStartDate(date)} 00:00`);
}

/**
 * Trigger a file download prompt with the given content
 */
export function promptDownload(
  data: string,
  fileName: string,
  type = 'text/plain'
): void {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

export function getCookie(name: string): string | null {
  const match = new RegExp(`(?:^|;) ?${name}=([^;]*)(?:;|$)`).exec(
    document.cookie
  );
  return match?.[1] ?? null;
}

/**
 * Fetch a URL and return its content as base64 (without the `data:` prefix)
 */
export async function urlToBase64(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const blob = await (await fetch(url)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error('Could not read image'));
    };
    reader.readAsDataURL(blob);
  });
  const match = /^data:([^;]+)[^,]*base64,(.*)$/i.exec(dataUrl);
  if (!match?.[1] || match[2] === undefined) {
    throw new Error('Unexpected data URL format');
  }
  return { mimeType: match[1], base64: match[2] };
}

export function setQueryParams(
  url: string,
  params: Record<string, string | number>
): string {
  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    urlObj.searchParams.set(key, value.toString());
  }
  return urlObj.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * LinkedIn stores translations of a field next to it, e.g. `firstName` +
 * `multiLocaleFirstName: { en_US: '...', de_DE: '...' }`. This hoists the value
 * for `locale` back into the plain field, recursively.
 *
 * WARNING: Modifies the value IN PLACE
 */
export function remapNestedLocale(value: unknown, locale: string): void {
  if (Array.isArray(value)) {
    for (const item of value) remapNestedLocale(item, locale);
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, nested] of Object.entries(value)) {
    if (!isRecord(nested)) continue;
    if (key.startsWith('multiLocale')) {
      if (Object.hasOwn(nested, locale)) {
        const plainKey = key.replace(/^multiLocale/, '');
        value[plainKey.charAt(0).toLowerCase() + plainKey.slice(1)] =
          nested[locale];
      }
    } else {
      remapNestedLocale(nested, locale);
    }
  }
}

/**
 * LinkedIn's API sometimes strips line breaks from long-form text (e.g. the
 * About section), leaving "sentence one!Sentence two". Restore paragraph breaks,
 * preferring the rendered page text (which still has them), and falling back to
 * a sentence-boundary heuristic.
 */
export function restoreParagraphBreaks(text: string): string {
  if (!text || text.includes('\n')) return text;

  const pageText = document.querySelector('main')?.innerText ?? '';
  if (pageText) {
    // Copy of the page text without newlines, mapping back to original indexes
    let stripped = '';
    const indexMap: number[] = [];
    for (let i = 0; i < pageText.length; i++) {
      const char = pageText.charAt(i);
      if (char !== '\n') {
        stripped += char;
        indexMap.push(i);
      }
    }
    const foundAt = stripped.indexOf(text);
    const startIdx = indexMap[foundAt];
    const endIdx = indexMap[foundAt + text.length - 1];
    if (foundAt !== -1 && startIdx !== undefined && endIdx !== undefined) {
      return pageText.slice(startIdx, endIdx + 1).replace(/\n{3,}/g, '\n\n');
    }
  }

  // Heuristic: "word.Next" / "word!I'm" -> paragraph break
  return text.replace(/([a-z)][.!?])([A-Z](?:[a-z']|\s))/g, '$1\n\n$2');
}
