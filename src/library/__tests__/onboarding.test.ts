import { markOnboardingSeen, seenTourVersion, TOUR_VERSION, tourSteps, type TourStepInfo } from '../onboarding';

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
