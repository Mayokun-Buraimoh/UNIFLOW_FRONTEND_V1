/**
 * Status-bar control for native (iOS / Android) platforms.
 *
 * IMPORTANT — Capacitor's `Style` enum is inverted from common-sense naming:
 *   - `Style.Dark`  => "light text for dark backgrounds"   (white icons)
 *   - `Style.Light` => "dark text for light backgrounds"   (dark icons)
 *   - `Style.Default` => follows the device appearance setting
 *
 * To avoid that footgun across the codebase we expose intent-named values:
 *   - 'dark-content'  => dark icons / dark text  (use on light/white backgrounds)
 *   - 'light-content' => light icons / white text (use on dark backgrounds)
 *   - 'default'       => let iOS pick from system appearance
 *
 * All calls are no-ops on the web. `setBackgroundColor` only has an effect on
 * Android; iOS overlays the web view under the status bar so that call is a
 * harmless no-op there.
 */
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type AppStatusBarStyle = 'dark-content' | 'light-content' | 'default';

const toCapacitorStyle = (style: AppStatusBarStyle): Style => {
  switch (style) {
    case 'light-content':
      return Style.Dark;
    case 'dark-content':
      return Style.Light;
    case 'default':
    default:
      return Style.Default;
  }
};

let lastAppliedStyle: AppStatusBarStyle | null = null;

/**
 * Apply the requested status-bar style. Safe to call from anywhere — it bails
 * out early on web and swallows plugin errors so a failure here can never
 * block navigation or rendering.
 */
export const applyStatusBarStyle = async (
  style: AppStatusBarStyle,
  backgroundColor?: string
): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: toCapacitorStyle(style) });
    lastAppliedStyle = style;
  } catch {
    /* plugin missing or transient native failure — ignore */
  }

  // setBackgroundColor only takes effect on Android; iOS draws under the bar.
  if (backgroundColor && Capacitor.getPlatform() === 'android') {
    try {
      await StatusBar.setBackgroundColor({ color: backgroundColor });
    } catch {
      /* ignore */
    }
  }
};

/** Returns the most recently applied style, or null if nothing has applied yet. */
export const getLastAppliedStatusBarStyle = (): AppStatusBarStyle | null => lastAppliedStyle;
