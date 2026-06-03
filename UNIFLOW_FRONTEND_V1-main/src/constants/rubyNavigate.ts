export const RUBY_NAVIGATE_EVENT = 'uniflow_ruby_navigate';

export type RubyNavigateMode = 'root' | 'forward';

export interface RubyNavigateDetail {
  path: string;
  mode: RubyNavigateMode;
}

export const RUBY_APP_TAB_PATHS = {
  home: '/home',
  plans: '/plans',
  courses: '/courses',
  settings: '/settings',
  chatbot: '/chatbot',
} as const;

export type RubyAppTab = keyof typeof RUBY_APP_TAB_PATHS;
