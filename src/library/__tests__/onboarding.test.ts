import {
  markOnboardingSeen,
  markWhatsToComeSeen,
  seenTourVersion,
  shouldShowWhatsToCome,
  TOUR_VERSION,
  tourSteps,
  whatsNewMessage,
  whatsToComeSeen,
  type TourStepInfo,
} from '../onboarding';

const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
  },
}));

beforeEach(() => mockStore.clear());

describe('seenTourVersion', () => {
  it('is null when the tour has never been seen', async () => {
    expect(await seenTourVersion()).toBeNull();
  });

  it('is the current version after finishing, skipping or being shown the tour', async () => {
    await markOnboardingSeen();
    expect(await seenTourVersion()).toBe(TOUR_VERSION);
  });

  it('is 1 for people who saw the original tour, which recorded no version', async () => {
    mockStore.set('onboarding.seen', '2025-01-01T00:00:00.000Z');
    expect(await seenTourVersion()).toBe(1);
  });

  it('is the version they saw for people who saw an older tour', async () => {
    mockStore.set('onboarding.seen', '2026-11-12T00:00:00.000Z');
    mockStore.set('onboarding.version', '3');
    expect(await seenTourVersion()).toBe(3);
  });
});

describe('tourSteps', () => {
  const step = (name: string, since: number, webOnly?: boolean) => ({ name, since, webOnly });
  const STEPS = [step('welcome', 1), step('ownership', 2), step('home screen', 3, true), step('spines', 4), step('backup', 1)];
  const names = (steps: (TourStepInfo & { name: string })[]) => steps.map((s) => s.name);

  it('shows the whole tour, in order, to someone who has never seen it', () => {
    expect(names(tourSteps(STEPS, null, { web: true }))).toEqual(['welcome', 'ownership', 'home screen', 'spines', 'backup']);
  });

  it('shows only what was added or changed since the version someone saw', () => {
    expect(names(tourSteps(STEPS, 3, { web: true }))).toEqual(['spines']);
    expect(names(tourSteps(STEPS, 1, { web: true }))).toEqual(['ownership', 'home screen', 'spines']);
  });

  it('shows nothing to someone who has seen the latest tour', () => {
    expect(tourSteps(STEPS, 4, { web: true })).toEqual([]);
  });

  it('leaves out browser-only steps outside a browser tab, even when they are new', () => {
    expect(names(tourSteps(STEPS, null, { web: false }))).toEqual(['welcome', 'ownership', 'spines', 'backup']);
    expect(tourSteps([step('home screen', 3, true)], 2, { web: false })).toEqual([]);
  });
});

describe('whatsNewMessage', () => {
  it('names a single new step', () => {
    expect(whatsNewMessage([{ title: 'What the spines mean' }])).toBe("There's something new: what the spines mean. Want a look?");
  });

  it('uses the step’s own news when it has some', () => {
    expect(whatsNewMessage([{ title: 'Friends’ library', news: 'Bookie has friends now. Want a look?' }])).toBe('Bookie has friends now. Want a look?');
  });

  it('counts several new steps', () => {
    expect(whatsNewMessage([{ title: 'Books you own' }, { title: 'Keep it on your home screen' }, { title: 'What the spines mean' }])).toBe(
      'The welcome tour has 3 new things in it. Want a look?',
    );
  });
});

describe('recordAppOpen', () => {
  // Each launch starts with a fresh copy of the module, as the app does.
  const launch = () => {
    let mod!: typeof import('../onboarding');
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('../onboarding');
    });
    return mod.recordAppOpen;
  };

  it('counts the first open as 1', async () => {
    expect(await launch()()).toBe(1);
  });

  it('counts each launch once, however often it is asked', async () => {
    const record = launch();
    expect(await record()).toBe(1);
    expect(await record()).toBe(1);
    expect(await launch()()).toBe(2);
    expect(await launch()()).toBe(3);
  });
});

describe('shouldShowWhatsToCome', () => {
  const ready = { opens: 3, books: 1, seen: false, tourOffered: false };

  it('shows from the third open to someone with a book', () => {
    expect(shouldShowWhatsToCome(ready)).toBe(true);
    expect(shouldShowWhatsToCome({ ...ready, opens: 7 })).toBe(true);
  });

  it('waits until the third open', () => {
    expect(shouldShowWhatsToCome({ ...ready, opens: 1 })).toBe(false);
    expect(shouldShowWhatsToCome({ ...ready, opens: 2 })).toBe(false);
  });

  it('waits until there is at least one book', () => {
    expect(shouldShowWhatsToCome({ ...ready, books: 0 })).toBe(false);
  });

  it('never shows again once it has been seen', () => {
    expect(shouldShowWhatsToCome({ ...ready, seen: true })).toBe(false);
  });

  it('stays out of the way of the welcome tour and its "What\'s new"', () => {
    expect(shouldShowWhatsToCome({ ...ready, tourOffered: true })).toBe(false);
  });
});

describe('whatsToComeSeen', () => {
  it('is false until it has been shown or closed, then true', async () => {
    expect(await whatsToComeSeen()).toBe(false);
    await markWhatsToComeSeen();
    expect(await whatsToComeSeen()).toBe(true);
  });
});
