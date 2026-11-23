/**
 * What to do with the library on this device when an account signs in.
 *
 * - 'sync': it's the account this device already syncs with: carry on.
 * - 'link': nothing to decide: there are no books here of anyone's (sample books never sync), or the account was
 *   just created on this device, which hasn't synced with any account before, so its books are what the account
 *   starts with.
 * - 'choose': ask first, whether to add this device's books to the account or replace them with the account's.
 *   Always the case when the books here were synced with a different account, so they never go to another one
 *   without being asked.
 */
export type LinkStep = 'sync' | 'link' | 'choose';

export function linkStep(p: { linkedUserId: string | null; accountId: string; localBooks: number; newAccount: boolean }): LinkStep {
  if (p.linkedUserId === p.accountId) return 'sync';
  if (p.localBooks === 0) return 'link';
  if (p.newAccount && p.linkedUserId == null) return 'link';
  return 'choose';
}
