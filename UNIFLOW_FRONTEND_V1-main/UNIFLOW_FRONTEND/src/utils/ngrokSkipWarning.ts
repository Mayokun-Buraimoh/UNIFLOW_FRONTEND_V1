/**
 * Ngrok free URLs may serve an HTML interstitial; without this header, fetch from
 * WebView/mobile often fails with "Failed to fetch" or non-JSON responses.
 * @see https://ngrok.com/docs/troubleshooting/troubleshoot-http/#bypass-warning-page
 */
export function isNgrokUrl(url: string): boolean {
  return /\.ngrok-free\.(app|dev)\b/i.test(url) || /\bngrok\.(io|app)\b/i.test(url);
}

export function ngrokSkipWarningHeaders(url: string): Record<string, string> {
  return isNgrokUrl(url) ? { 'ngrok-skip-browser-warning': 'true' } : {};
}
