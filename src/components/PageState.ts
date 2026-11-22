import { createContext, useContext } from 'react';

export interface PageState {
  /** The page has been shown, or is sliding in. Heavy pictures wait for this before drawing their insides. */
  reached: boolean;
  /** The page is the one on screen. Animated pictures only play while it is. */
  current: boolean;
}

/**
 * Where a picture's page stands in the "What's to come" preview, where every page is mounted at once. Anywhere else a
 * picture is simply on screen.
 */
export const PageStateContext = createContext<PageState>({ reached: true, current: true });

export const usePageState = () => useContext(PageStateContext);
