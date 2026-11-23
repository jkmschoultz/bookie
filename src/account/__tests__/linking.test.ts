import { linkStep } from '../linking';

const base = { accountId: 'b', localBooks: 5, newAccount: false };

describe('linkStep', () => {
  it('carries on syncing with the account this device already syncs with', () => {
    expect(linkStep({ ...base, linkedUserId: 'b' })).toBe('sync');
  });

  it('asks before another account gets the books synced with the last one, on every way in', () => {
    expect(linkStep({ ...base, linkedUserId: 'a' })).toBe('choose');
    // Even a brand-new account made on a device that synced with someone else.
    expect(linkStep({ ...base, linkedUserId: 'a', newAccount: true })).toBe('choose');
  });

  it('asks before merging a device’s books into an existing account the first time', () => {
    expect(linkStep({ ...base, linkedUserId: null })).toBe('choose');
  });

  it('just links when there is nothing to decide', () => {
    expect(linkStep({ ...base, linkedUserId: 'a', localBooks: 0 })).toBe('link');
    expect(linkStep({ ...base, linkedUserId: null, localBooks: 0 })).toBe('link');
    // An account created here, on a device that never synced, starts with this device's books.
    expect(linkStep({ ...base, linkedUserId: null, newAccount: true })).toBe('link');
  });
});
