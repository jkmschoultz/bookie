import type { ReactNode } from 'react';

import {
  BookClubExample,
  FriendsLibraryExample,
  ReadingCalendarExample,
  SuggestedReadingExample,
  VinylAndDvdExample,
} from '@/components/ComingLaterExamples';

export interface WhatsToComePage {
  /** The small tag over the title. */
  tag: string;
  icon: string;
  title: string;
  body: string;
  /** Shown under the body. */
  visual?: ReactNode;
}

const LATER = 'Coming later';

/** The "What's to come" preview, in order: ideas for later, none of which work yet. */
export const WHATS_TO_COME_PAGES: WhatsToComePage[] = [
  {
    tag: 'A preview',
    icon: '🔭',
    title: 'What’s to come',
    body: 'Here are some ideas for where Bookie is heading. None of them work yet, and plans may change along the way.',
  },
  {
    tag: LATER,
    icon: '👥',
    title: 'Friends’ library',
    body: 'A shared room of bookcases, where each shelf belongs to a friend. Sharing would need optional cloud storage, and keeping your library on this device only stays an option.',
    visual: <FriendsLibraryExample />,
  },
  {
    tag: LATER,
    icon: '💿',
    title: 'Vinyl and DVDs',
    body: 'Shelves for your records and films, next to your books.',
    visual: <VinylAndDvdExample />,
  },
  {
    tag: LATER,
    icon: '☕',
    title: 'Book clubs',
    body: 'Start a club with friends and share one synced shelf. Everyone in the club sees the same books.',
    visual: <BookClubExample />,
  },
  {
    tag: LATER,
    icon: '💡',
    title: 'Suggested reading',
    body: 'Ideas for what to read next, based on the books on your shelves.',
    visual: <SuggestedReadingExample />,
  },
  {
    tag: LATER,
    icon: '🗓️',
    title: 'Reading calendar',
    body: 'A suggested reading plan that spreads your books over the days of a month, so you know how much to read each day.',
    visual: <ReadingCalendarExample />,
  },
];
