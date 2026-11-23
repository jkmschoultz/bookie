import Storage from 'expo-sqlite/kv-store';

import { loadSaved, NOTHING_SAVED } from '../saved';

jest.mock('expo-sqlite/kv-store', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

const getItem = Storage.getItem as jest.Mock;

describe('loadSaved', () => {
  beforeEach(() => getItem.mockReset());

  it('returns nothing saved when the account key is empty', async () => {
    getItem.mockResolvedValue(null);
    await expect(loadSaved()).resolves.toEqual(NOTHING_SAVED);
  });

  it('returns nothing saved when the stored text is not JSON', async () => {
    getItem.mockResolvedValue('{not json');
    await expect(loadSaved()).resolves.toEqual(NOTHING_SAVED);
  });

  it('keeps the stored link and sync position', async () => {
    getItem.mockResolvedValue(JSON.stringify({ linkedUserId: 'u1', cursor: 42, bulk: true }));
    await expect(loadSaved()).resolves.toMatchObject({ linkedUserId: 'u1', cursor: 42, bulk: true, syncEnabled: true });
  });

  it('rejects when storage can not be read, rather than reporting nothing saved', async () => {
    getItem.mockRejectedValue(new Error('database is locked'));
    await expect(loadSaved()).rejects.toThrow('database is locked');
  });
});
