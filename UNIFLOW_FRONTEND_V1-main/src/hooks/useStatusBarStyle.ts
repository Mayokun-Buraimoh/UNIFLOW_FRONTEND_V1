import { useEffect } from 'react';
import { useIonViewWillEnter } from '@ionic/react';
import { applyStatusBarStyle, type AppStatusBarStyle } from '../utils/statusBar';

/**
 * Apply a status-bar style for the lifetime of an Ionic page.
 *
 * Uses `useIonViewWillEnter` (rather than a plain `useEffect`) because Ionic
 * keeps pages mounted in the router outlet and only animates them in/out, so
 * a `useEffect` mount-handler would only fire the first time the page is
 * visited. `useIonViewWillEnter` fires every time the page becomes the
 * foreground view, which is exactly the moment we want to (re)apply the style.
 *
 * Falls back to a normal effect for the very first render, so the style is
 * correct even before the Ionic view lifecycle event fires (e.g. when a page
 * is the initial route after a fresh launch).
 *
 * @example
 *   useStatusBarStyle('light-content'); // dark page (white icons)
 *   useStatusBarStyle('dark-content');  // light/white page (dark icons)
 */
export const useStatusBarStyle = (
  style: AppStatusBarStyle,
  backgroundColor?: string
): void => {
  useIonViewWillEnter(() => {
    void applyStatusBarStyle(style, backgroundColor);
  });

  useEffect(() => {
    void applyStatusBarStyle(style, backgroundColor);
  }, [style, backgroundColor]);
};
