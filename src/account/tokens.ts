import * as SecureStore from 'expo-secure-store';

/** On phones the refresh token is kept in the keychain (iOS) or keystore (Android). */
const KEY = 'bookie.refresh';

export const CLIENT = 'native' as const;

export const loadRefreshToken = () => SecureStore.getItemAsync(KEY);
export const saveRefreshToken = (token: string) => SecureStore.setItemAsync(KEY, token);
export const forgetRefreshToken = () => SecureStore.deleteItemAsync(KEY);
