import { hit, LIMITS, sweep } from '../rateLimit';
import { memoryDb } from './memoryDb';

describe('sweep', () => {
  it('clears counters whose windows ended a day ago, and keeps the rest', async () => {
    const db = memoryDb();
    const day = 24 * 60 * 60 * 1000;
    await hit(db, LIMITS.signupIp, 'old', 0);
    await hit(db, LIMITS.friendRequests, 'recent', 5 * 60 * 60 * 1000);
    await sweep(db, day + 1000);
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM rate_limits').get()!.n).toBe(1);
  });
});
