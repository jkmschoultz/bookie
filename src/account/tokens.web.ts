/**
 * On the web the refresh token is an HttpOnly cookie the page can't read, set and sent by the browser for /api/auth.
 * Nothing is kept here.
 */
export const CLIENT = 'web' as const;

export const loadRefreshToken = async (): Promise<string | null> => null;
export const saveRefreshToken = async (_token: string): Promise<void> => {};
export const forgetRefreshToken = async (): Promise<void> => {};
