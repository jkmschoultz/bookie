import type { Href } from 'expo-router';
import type { ReactNode } from 'react';

import {
  BookClubExample,
  ReadingCalendarExample,
  SuggestedReadingExample,
  VinylAndDvdExample,
} from '@/components/ComingLaterExamples';
import { CustomShelvesExample } from '@/components/CustomShelvesExample';

export interface WhatsToComePage {
  /** The small tag over the title. */
  tag: string;
  icon: string;
  title: string;
  body: string;
  /** Shown under the body. */
  visual?: ReactNode;
  /** For an idea that's here now: a button to open it. */
  action?: { label: string; href: Href };
}

const LATER = 'Coming later';

/** The "What's to come" preview: ideas for later. */
export const WHATS_TO_COME_PAGES: WhatsToComePage[] = [
  {
    tag: 'A preview',
    icon: '🔭',
    title: 'What’s to come',
    body: 'Here are some ideas for where Bookie is heading. None of them work yet, and plans may change along the way.',
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
    icon: '🪵',
    title: 'Make your shelves yours',
    body: 'Choose wood, metal or glass, and place plants and other small things where you like.',
    visual: <CustomShelvesExample />,
  },
  {
    tag: LATER,
    icon: '🗓️',
    title: 'Reading calendar',
    body: 'A suggested reading plan that spreads your books over a month. Each book’s cover marks the days you’d read it.',
    visual: <ReadingCalendarExample />,
  },
];
