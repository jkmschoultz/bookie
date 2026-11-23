import { Platform } from 'react-native';

/**
 * Seasonal themes for the Friends hallway. Each season has its dates, on the device's own calendar; add one by giving
 * it a name here and its dates in SEASONS, and draw it in the hallway (see FriendsLibraryHallway).
 */
export type Season = 'christmas';

type MonthDay = [month: number, day: number];

interface SeasonDates {
  season: Season;
  /** First and last day, inclusive, as [month (1–12), day], or worked out for the year. A season may run over New Year. */
  from: MonthDay | ((year: number) => MonthDay);
  to: MonthDay;
}

/** The first Sunday of Advent: the fourth Sunday before Christmas, between 27 November and 3 December. */
export function firstAdvent(year: number): MonthDay {
  const nov27 = new Date(year, 10, 27);
  const day = 27 + ((7 - nov27.getDay()) % 7);
  return day <= 30 ? [11, day] : [12, day - 30];
}

/** Christmas starts on the first Sunday of Advent; in 2026 it started early, on 22 November. */
const christmasStart = (year: number): MonthDay => (year === 2026 ? [11, 22] : firstAdvent(year));

const SEASONS: SeasonDates[] = [{ season: 'christmas', from: christmasStart, to: [1, 6] }];

const dayOfYear = (month: number, day: number) => month * 100 + day;

/** The season on this date (the device's local date), or null outside every season. */
export function getSeason(date: Date): Season | null {
  const today = dayOfYear(date.getMonth() + 1, date.getDate());
  for (const { season, from, to } of SEASONS) {
    const start = dayOfYear(...(typeof from === 'function' ? from(date.getFullYear()) : from));
    const end = dayOfYear(...to);
    const inside = start <= end ? today >= start && today <= end : today >= start || today <= end;
    if (inside) return season;
  }
  return null;
}

/** The live site and its alias for the master branch: the preview parameter below is ignored there. */
const PRODUCTION_HOSTS = ['mybookie.pages.dev', 'master.mybookie.pages.dev'];

/**
 * A season asked for in the address, to preview it out of season: `?season=christmas`, or `?season=none` for none.
 * Only on the web, and never on the live site (nor its master alias). Undefined when nothing (valid) was asked for.
 */
export function previewSeason(location: { hostname: string; search: string } | null): Season | null | undefined {
  if (!location || PRODUCTION_HOSTS.includes(location.hostname.toLowerCase())) return undefined;
  const asked = new URLSearchParams(location.search).get('season');
  if (asked === 'none') return null;
  return SEASONS.some((s) => s.season === asked) ? (asked as Season) : undefined;
}

const PREVIEW_KEY = 'bookie.season';

/** Called when the app starts: remembers a season asked for in the address the app was opened at. */
export function rememberSeasonPreview(): void {
  currentSeason();
}

/**
 * Today's season, or the one previewed in the address (see previewSeason). A preview lasts for the browser tab's
 * session, so it carries on as the app moves to other pages (whose addresses don't have it).
 */
export function currentSeason(now = new Date()): Season | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return getSeason(now);
  let preview = previewSeason(window.location);
  try {
    if (preview !== undefined) window.sessionStorage.setItem(PREVIEW_KEY, preview ?? 'none');
    else if (!PRODUCTION_HOSTS.includes(window.location.hostname.toLowerCase())) preview = previewSeason({ hostname: window.location.hostname, search: `?season=${window.sessionStorage.getItem(PREVIEW_KEY)}` });
  } catch {
    // No session storage (private mode): the preview lasts for this page only.
  }
  return preview === undefined ? getSeason(now) : preview;
}
