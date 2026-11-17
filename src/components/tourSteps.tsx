import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { HomeAnimation } from '@/components/HomeAnimation';
import { HomeScreenGuide } from '@/components/HomeScreenGuide';
import { OwnershipExample } from '@/components/OwnershipExample';
import { SizeExample } from '@/components/SizeExample';
import { StatusExample } from '@/components/StatusExample';
import { isStandalone } from '@/library/bringBooks';
import type { TourStepInfo } from '@/library/onboarding';

export interface TourStep extends TourStepInfo {
  icon: string;
  title: string;
  points: string[];
  /** Shown under the points. */
  visual?: ReactNode;
}

/** The welcome tour, in order. Give a new or changed step the current `TOUR_VERSION` as its `since`. */
export const TOUR_STEPS: TourStep[] = [
  {
    since: 1,
    icon: '📚',
    title: 'Welcome to Bookie',
    points: [
      'Your books, on a virtual bookshelf.',
      'Swipe left and right to browse along a shelf, and up and down across the bookcase.',
      'Book sizes represent the real size of the books.',
    ],
    visual: <HomeAnimation />,
  },
  {
    since: 1,
    icon: '＋',
    title: 'Fill your shelves',
    points: [
      'Tap ＋ to search for a book, scan the barcode on its back cover, or type in the details.',
      'Already on Goodreads? Import your whole library in one go, or start with a sample library.',
      'Each book is drawn to size: thicker means more pages, taller means a bigger book.',
    ],
    visual: <SizeExample />,
  },
  {
    since: 1,
    icon: '⇅',
    title: 'Arrange and track',
    points: [
      'Sort shelves by genre, author, title, publish date or what you read recently.',
      'Filter by reading progress: Reading, Read, Unread, Want to read or Did not finish.',
      'Tap a book for its details, or press and hold it to change its status.',
    ],
  },
  {
    since: 4,
    icon: '🔖',
    title: 'What the spines mean',
    points: ['Every spine shows where you are with the book, so you can see it at a glance.'],
    visual: <StatusExample />,
  },
  {
    // Added before the tour recorded its version, so everyone who saw it is down as version 1 and sees it again.
    since: 2,
    icon: '📖',
    title: 'Books you own, and books you don’t',
    points: [
      'A book on your shelf looks solid. One you don’t own, such as a borrowed or library book, is faded.',
      'Choose which when you add a book. You’ll be asked again when you start a book you wanted, and you can switch it any time from its page or by pressing and holding it.',
    ],
    visual: <OwnershipExample />,
  },
  {
    since: 3,
    icon: '📲',
    title: 'Keep it on your home screen',
    points: [
      'Add Bookie to your home screen to open it like an app, full screen.',
      'Do this before adding books: the home-screen app can have its own empty library, separate from the browser. Settings → Export backup and Restore from backup move books across.',
    ],
    visual: <HomeScreenGuide />,
    webOnly: true,
  },
  {
    since: 1,
    icon: '🔒',
    title: 'Your library stays with you',
    points: [
      'Everything is stored on this device only, with no account and no cloud.',
      'Use Settings → Export backup now and then to keep a copy somewhere safe.',
    ],
  },
];

/** Whether the browser-only steps apply: in a browser tab, not once Bookie has been added to the home screen. */
export function inBrowserTab(): boolean {
  return Platform.OS === 'web' && !isStandalone();
}
