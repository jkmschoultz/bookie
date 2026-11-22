import { createContext, useContext } from 'react';

/**
 * Whether the page a picture sits on has been reached yet. The "What's to come" pages are all mounted at once, so a
 * heavy picture can wait for this before drawing its insides, keeping opening the preview quick. True anywhere else.
 */
export const PageReachedContext = createContext(true);

export const usePageReached = () => useContext(PageReachedContext);
