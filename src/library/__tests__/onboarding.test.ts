import { markOnboardingSeen, tourStatus } from '../onboarding';

const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
  },
}));

beforeEach(() => mockStore.clear());

describe('tourStatus', () => {
  it('is new when the tour has never been seen', async () => {
    expect(await tourStatus()).toBe('new');
  });

  it('is current after finishing or skipping the tour', async () => {
    await markOnboardingSeen();
    expect(await tourStatus()).toBe('current');
  });

  it('is updated for people who saw the original tour, which recorded no version', async () => {
    mockStore.set('onboarding.seen', '2025-01-01T00:00:00.000Z');
    expect(await tourStatus()).toBe('updated');
    await markOnboardingSeen();
    expect(await tourStatus()).toBe('current');
  });
});
