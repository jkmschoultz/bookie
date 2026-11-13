import { distinctCoverIds, findCoverOptions } from '../covers';

const json = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

describe('cover options', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps distinct real cover ids, in order, up to a limit', () => {
    expect(distinctCoverIds([5, -1, 5, null, 0, 7, 8], 2)).toEqual([5, 7]);
  });

  it('collects covers from every edition of a known work', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      expect(String(url)).toBe('https://openlibrary.org/works/OL1W/editions.json?limit=100');
      return json({ entries: [{ covers: [11, -1] }, {}, { covers: [12, 11] }] });
    });
    expect(await findCoverOptions({ workKey: '/works/OL1W', title: 'Dune' })).toEqual([
      'https://covers.openlibrary.org/b/id/11-M.jpg',
      'https://covers.openlibrary.org/b/id/12-M.jpg',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('finds the work from the ISBN first, and puts its cover first', async () => {
    const urls: string[] = [];
    jest.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      urls.push(String(url));
      return String(url).includes('search.json') ? json({ docs: [{ key: '/works/OL2W', cover_i: 3 }] }) : json({ entries: [{ covers: [4] }] });
    });
    const covers = await findCoverOptions({ isbn: '9780441013593', title: 'Dune', author: 'Frank Herbert' });
    expect(urls[0]).toContain('q=isbn:9780441013593');
    expect(covers).toEqual(['https://covers.openlibrary.org/b/id/3-M.jpg', 'https://covers.openlibrary.org/b/id/4-M.jpg']);
  });

  it('gives up quietly when offline or given an odd work key', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await findCoverOptions({ title: 'Dune' })).toEqual([]);
    expect(await findCoverOptions({ workKey: '../../evil', title: 'Dune' })).toEqual([]);
  });
});
