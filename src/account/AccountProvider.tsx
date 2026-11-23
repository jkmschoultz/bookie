import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { AppState, Platform } from 'react-native';

import * as repo from '@/db/books';
import { useLibrary } from '@/library/LibraryProvider';
import { deleteCoverPhotos, saveJsonFile } from '@/services/files';
import type { AccountSummary } from '@shared/account';
import { today } from '@/types';

import { friendBadgeOf, NO_BADGE, type FriendBadge, type FriendLists } from './friends';
import { api, apiAvailable, ApiError, forgetSession, publicApi, refreshSession, startSession } from './api';
import { linkStep } from './linking';
import { onLocalChange } from './localChanges';
import { createPasskey, passkeysSupported, presentPasskey } from './passkeys';
import { loadSaved, NOTHING_SAVED, storeSaved, type Saved } from './saved';
import { syncLibrary } from './sync';
import { CLIENT, loadRefreshToken } from './tokens';

/**
 * The optional account: signing up and in, and keeping this device's library in sync with it. Without an account
 * nothing leaves the device. If the API isn't there (not set up, or the Expo dev server) `status` is 'unavailable' and
 * the app works as before.
 */

export type AccountStatus = 'checking' | 'unavailable' | 'signedOut' | 'signedIn';

export interface SyncState {
  busy: boolean;
  lastSyncedAt: number | null;
  /** Why the last sync didn't finish, to show; it's tried again later. */
  problem: string | null;
}

/** An account that signed in on a device whose books it doesn't have yet: what to do with them is asked first. */
export interface PendingLink {
  account: AccountSummary;
  /** The books here were synced with a different account. */
  switching: boolean;
  books: number;
}

/** After signing in or up: a recovery code to show once, and whether the user has to choose what happens to the books. */
export interface SignInResult {
  recoveryCode: string | null;
  choose: boolean;
}

interface Account {
  status: AccountStatus;
  account: AccountSummary | null;
  /** Signed in, but the account can't be reached right now. */
  offline: boolean;
  syncEnabled: boolean;
  sync: SyncState;
  /** Friend requests waiting for an answer, and friends with news you haven't seen, for the badge on the Friends button. */
  friendBadge: FriendBadge;
  setFriendBadge: Dispatch<SetStateAction<FriendBadge>>;
  passkeys: boolean;
  /** Set until the user has chosen to add this device's books to the account or replace them; nothing syncs till then. */
  pendingLink: PendingLink | null;
  /** Add this device's books to the account, replace them with the account's, or cancel (which signs out). */
  chooseLink: (choice: 'add' | 'replace' | 'cancel') => Promise<void>;
  signUpWithPassword: (username: string, displayName: string, password: string) => Promise<SignInResult>;
  signUpWithPasskey: (username: string, displayName: string) => Promise<SignInResult>;
  signInWithPassword: (username: string, password: string) => Promise<SignInResult>;
  signInWithPasskey: () => Promise<SignInResult>;
  /** Sets a new password with the recovery code, which comes with a new recovery code. */
  recover: (username: string, recoveryCode: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  setSyncEnabled: (on: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  /** Adds a password (resolves to a new recovery code) or changes it (resolves to null). */
  setPassword: (password: string, currentPassword?: string) => Promise<string | null>;
  addPasskey: () => Promise<void>;
  setShelfVisible: (visible: boolean) => Promise<void>;
  exportData: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

interface Session {
  accessToken: string;
  refreshToken?: string;
  account: AccountSummary;
  recoveryCode?: string;
}

interface PasskeyOptions {
  challengeId: string;
  options: unknown;
}

const AccountContext = createContext<Account | null>(null);

/** Sync this long after the last edit, so a burst of edits goes in one request. */
const EDIT_DELAY_MS = 2500;
/** After a failed sync, wait this long before trying again, longer each time. */
const RETRY_MS = [30_000, 2 * 60_000, 10 * 60_000];

export function AccountProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { reload } = useLibrary();
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [status, setStatus] = useState<AccountStatus>('checking');
  const [offline, setOffline] = useState(false);
  const [saved, setSavedState] = useState<Saved>(NOTHING_SAVED);
  const [sync, setSync] = useState<SyncState>({ busy: false, lastSyncedAt: null, problem: null });
  const [friendBadge, setFriendBadge] = useState<FriendBadge>(NO_BADGE);

  // The latest values, for timers and listeners.
  const now = useRef({ saved, status });
  useEffect(() => {
    now.current = { saved, status };
  }, [saved, status]);

  // Set when the saved account state couldn't be read on launch: nothing is written over it until a restart.
  const savedUnreadable = useRef(false);

  const save = useCallback(async (patch: Partial<Saved>) => {
    if (savedUnreadable.current) return;
    const next = { ...now.current.saved, ...patch };
    now.current.saved = next;
    setSavedState(next);
    await storeSaved(next);
  }, []);

  const syncing = useRef<Promise<void> | null>(null);
  const retry = useRef<{ timer?: ReturnType<typeof setTimeout>; failures: number }>({ failures: 0 });

  const signedOutHere = useCallback(async () => {
    await forgetSession();
    setPendingLink(null);
    await save({ account: null });
    setOffline(false);
    setStatus('signedOut');
  }, [save]);

  const refreshFriendBadge = useCallback(async () => {
    try {
      setFriendBadge(friendBadgeOf(await api<FriendLists>('GET', '/api/friends')));
    } catch {
      // Only for the badge; the Friends screen shows any problem.
    }
  }, []);

  const runSync = useCallback((): Promise<void> => {
    const { saved: s, status: st } = now.current;
    // Only with the account this device's library belongs to: never another one's, before the user has chosen.
    if (st !== 'signedIn' || !s.syncEnabled || !s.account || s.linkedUserId !== s.account.id) return Promise.resolve();
    syncing.current ??= (async () => {
      clearTimeout(retry.current.timer);
      setSync((x) => ({ ...x, busy: true }));
      try {
        const { changed, done } = await syncLibrary(db, now.current.saved.cursor, (cursor) => save({ cursor }), !!now.current.saved.bulk);
        if (changed) await reload();
        const at = Date.now();
        await save({ lastSyncedAt: at, ...(done ? { bulk: false } : {}) });
        refreshFriendBadge();
        retry.current.failures = 0;
        setOffline(false);
        setSync({ busy: false, lastSyncedAt: at, problem: null });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await signedOutHere();
          setSync((x) => ({ ...x, busy: false, problem: null }));
          return;
        }
        // Offline, a daily limit reached, or the account briefly unavailable: the library carries on here, and the
        // changes wait for the next try.
        setOffline(e instanceof ApiError && e.status === 0);
        const wait = RETRY_MS[Math.min(retry.current.failures++, RETRY_MS.length - 1)];
        retry.current.timer = setTimeout(() => runSync(), wait);
        setSync((x) => ({ ...x, busy: false, problem: e instanceof Error ? e.message : 'Sync didn’t finish. Bookie will try again.' }));
      } finally {
        syncing.current = null;
      }
    })();
    return syncing.current;
  }, [db, reload, save, signedOutHere, refreshFriendBadge]);

  /** Makes this device's library the account's from now on: either sending it all (merged), or swapping it for the account's. */
  const link = useCallback(
    async (account: AccountSummary, choice: 'add' | 'replace') => {
      if (choice === 'replace') {
        await repo.clearLibrary(db);
        deleteCoverPhotos();
        await reload();
      } else await repo.markAllUnsent(db);
      await save({ linkedUserId: account.id, cursor: 0, syncEnabled: true, lastSyncedAt: null, bulk: choice === 'add' });
      setPendingLink(null);
      runSync();
    },
    [db, reload, save, runSync],
  );

  /**
   * After any sign-in or sign-up: remember the account, then sync with it, or first ask what to do with the books
   * here (see linkStep). Resolves to whether there's a choice to make.
   */
  const signedIn = useCallback(
    async (account: AccountSummary, newAccount = false): Promise<boolean> => {
      const s = now.current.saved;
      await save({ account });
      now.current.status = 'signedIn';
      setOffline(false);
      setStatus('signedIn');
      refreshFriendBadge();
      const books = await repo.countSyncable(db);
      const step = linkStep({ linkedUserId: s.linkedUserId, accountId: account.id, localBooks: books, newAccount });
      if (step === 'sync') runSync();
      else if (step === 'link') await link(account, 'add');
      else setPendingLink({ account, switching: s.linkedUserId != null, books });
      return step === 'choose';
    },
    [db, save, runSync, refreshFriendBadge, link],
  );

  // On launch: is there an API here, and still a session?
  useEffect(() => {
    (async () => {
      let s: Saved;
      try {
        s = await loadSaved();
      } catch {
        // Can't read this device's account state: sync stays off for this launch, and nothing is written over it.
        savedUnreadable.current = true;
        setStatus('unavailable');
        return;
      }
      now.current.saved = s;
      setSavedState(s);
      setSync((x) => ({ ...x, lastSyncedAt: s.lastSyncedAt }));
      if (!s.linkedUserId) await repo.purgeTombstones(db, true);
      try {
        if (!(await apiAvailable())) {
          setStatus('unavailable');
          return;
        }
        const account = await refreshSession();
        if (account) await signedIn(account);
        else await signedOutHere();
      } catch {
        // Offline: carry on as whatever we were last time.
        setOffline(true);
        setStatus(s.account ? 'signedIn' : 'signedOut');
      }
    })();
  }, [db, signedIn, signedOutHere]);

  // Sync shortly after edits, and whenever the app comes back to the front or the browser comes back online.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onLocalChange(() => {
      clearTimeout(timer);
      // Without an account, deletions don't need keeping for anyone.
      if (!now.current.saved.linkedUserId) timer = setTimeout(() => repo.purgeTombstones(db, true), EDIT_DELAY_MS);
      else timer = setTimeout(() => runSync(), EDIT_DELAY_MS);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      runSync();
      if (now.current.status === 'signedIn') refreshFriendBadge();
    });
    const online = () => runSync();
    if (Platform.OS === 'web') window.addEventListener('online', online);
    return () => {
      clearTimeout(timer);
      off();
      appState.remove();
      if (Platform.OS === 'web') window.removeEventListener('online', online);
    };
  }, [db, runSync, refreshFriendBadge]);

  const value = useMemo<Account>(() => {
    const begin = async (session: Session, newAccount = false): Promise<SignInResult> => {
      await startSession(session);
      const choose = await signedIn(session.account, newAccount);
      return { recoveryCode: session.recoveryCode ?? null, choose };
    };
    const signOut = async () => {
      try {
        await publicApi('POST', '/api/auth/signout', CLIENT === 'native' ? { refreshToken: await loadRefreshToken() } : {});
      } catch {
        // Offline: the session ends on its own; this device forgets it either way.
      }
      await signedOutHere();
    };
    const updated = (account: AccountSummary) => save({ account });
    return {
      status,
      account: saved.account,
      offline,
      syncEnabled: saved.syncEnabled,
      sync,
      friendBadge,
      setFriendBadge,
      passkeys: passkeysSupported(),
      pendingLink,
      chooseLink: async (choice) => {
        if (!pendingLink) return;
        if (choice === 'cancel') await signOut();
        else await link(pendingLink.account, choice);
      },
      signUpWithPassword: async (username, displayName, password) =>
        begin(await publicApi<Session>('POST', '/api/auth/password/signup', { username, displayName, password }), true),
      signUpWithPasskey: async (username, displayName) => {
        const { challengeId, options } = await publicApi<PasskeyOptions>('POST', '/api/auth/passkey/signup/options', { username, displayName });
        const response = await createPasskey(options);
        return begin(await publicApi<Session>('POST', '/api/auth/passkey/signup/verify', { challengeId, response }), true);
      },
      signInWithPassword: async (username, password) => begin(await publicApi<Session>('POST', '/api/auth/password/signin', { username, password })),
      signInWithPasskey: async () => {
        const { challengeId, options } = await publicApi<PasskeyOptions>('POST', '/api/auth/passkey/signin/options', {});
        const response = await presentPasskey(options);
        return begin(await publicApi<Session>('POST', '/api/auth/passkey/signin/verify', { challengeId, response }));
      },
      recover: async (username, recoveryCode, password) =>
        begin(await publicApi<Session>('POST', '/api/auth/password/recover', { username, recoveryCode, password })),
      signOut,
      setSyncEnabled: async (on) => {
        await save({ syncEnabled: on });
        if (on) runSync();
      },
      syncNow: runSync,
      setPassword: async (password, currentPassword) => {
        const res = await api<{ account: AccountSummary; recoveryCode?: string }>('POST', '/api/account/password', { password, currentPassword });
        await updated(res.account);
        return res.recoveryCode ?? null;
      },
      addPasskey: async () => {
        const { challengeId, options } = await api<PasskeyOptions>('POST', '/api/account/passkeys/options', {});
        const response = await createPasskey(options);
        await updated((await api<{ account: AccountSummary }>('POST', '/api/account/passkeys/verify', { challengeId, response })).account);
      },
      setShelfVisible: async (visible) => {
        await updated((await api<{ account: AccountSummary }>('PATCH', '/api/account', { shelfVisible: visible })).account);
      },
      exportData: async () => {
        const data = await api<unknown>('GET', '/api/account/export');
        await saveJsonFile(`bookie-account-${today()}.json`, JSON.stringify(data, null, 2));
      },
      deleteAccount: async () => {
        await api('DELETE', '/api/account');
        await forgetSession();
        // The library stays on this device, no longer linked to any account.
        await save({ ...NOTHING_SAVED });
        await repo.purgeTombstones(db, true);
        setPendingLink(null);
        setStatus('signedOut');
        setFriendBadge(NO_BADGE);
      },
    };
  }, [status, saved, offline, sync, friendBadge, pendingLink, signedIn, link, save, runSync, signedOutHere, db]);

  return <AccountContext value={value}>{children}</AccountContext>;
}

export function useAccount(): Account {
  const ctx = use(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>');
  return ctx;
}
