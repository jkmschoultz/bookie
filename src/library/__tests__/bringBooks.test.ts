import { isAppleTouchDevice, shouldShowBringBooks } from '../bringBooks';

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: {} }));

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

describe('isAppleTouchDevice', () => {
  it('spots an iPhone', () => {
    expect(isAppleTouchDevice(IPHONE, 5)).toBe(true);
  });

  it('spots an iPad that says it is a Mac, by its touch screen', () => {
    expect(isAppleTouchDevice(IPAD_AS_MAC, 5)).toBe(true);
  });

  it('leaves out a real Mac and Android', () => {
    expect(isAppleTouchDevice(IPAD_AS_MAC, 0)).toBe(false);
    expect(isAppleTouchDevice(ANDROID, 5)).toBe(false);
  });
});

describe('shouldShowBringBooks', () => {
  const show = { homeScreenApp: true, loaded: true, bookCount: 0, dismissed: false, moved: false };

  it('shows in the home-screen app with an empty library', () => {
    expect(shouldShowBringBooks(show)).toBe(true);
  });

  it('only shows in the home-screen app', () => {
    expect(shouldShowBringBooks({ ...show, homeScreenApp: false })).toBe(false);
  });

  it('waits for the library and the dismissal to load', () => {
    expect(shouldShowBringBooks({ ...show, loaded: false })).toBe(false);
    expect(shouldShowBringBooks({ ...show, dismissed: null })).toBe(false);
  });

  it('hides once there are books, or once dismissed', () => {
    expect(shouldShowBringBooks({ ...show, bookCount: 1 })).toBe(false);
    expect(shouldShowBringBooks({ ...show, dismissed: true })).toBe(false);
  });

  it('leaves the space to the "Bookie has moved" banner', () => {
    expect(shouldShowBringBooks({ ...show, moved: true })).toBe(false);
  });
});
