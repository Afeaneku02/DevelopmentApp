import type { InteractionMethod, OnboardingMode } from '@better-you/contracts';

// Shared between ProfileScreen and the Onboarding first-run steps so both
// present the exact same options (CLAUDE.md §5: avoid duplicate logic).

// UTC is a valid Intl timezone but Intl.supportedValuesOf('timeZone') omits it
// (see the lessons-learned entry from the Profile domain's backend work) - add
// it back explicitly so it's selectable, since it's also our own default.
export const TIMEZONE_OPTIONS = ['UTC', ...Intl.supportedValuesOf('timeZone')];

// A curated set, not an exhaustive locale database (none exists as a browser
// built-in) - "Other" isn't offered yet since free-text locale entry is a
// small enough addition to defer until someone actually needs it.
export const LOCALE_OPTIONS: { value: string; label: string }[] = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'it-IT', label: 'Italiano (Italia)' },
  { value: 'ja-JP', label: '日本語 (日本)' },
  { value: 'zh-CN', label: '中文（中国大陆）' },
  { value: 'zh-TW', label: '中文（台灣）' },
  { value: 'ko-KR', label: '한국어 (대한민국)' },
  { value: 'hi-IN', label: 'हिन्दी (भारत)' },
  { value: 'ar-SA', label: 'العربية (السعودية)' },
  { value: 'ru-RU', label: 'Русский (Россия)' },
];

// Descriptions drawn from Vision §5.2, not invented.
export const ONBOARDING_MODE_OPTIONS: {
  value: OnboardingMode;
  label: string;
  description: string;
  recommended?: boolean;
}[] = [
  { value: 'dive_in', label: 'Dive in', description: 'State your goals right away and start planning immediately.' },
  {
    value: 'guided_middle_ground',
    label: 'Guided middle ground',
    description: 'Share a few goals now while Better You keeps learning about you.',
    recommended: true,
  },
  {
    value: 'gradual',
    label: 'Gradual',
    description: 'Let Better You learn about you first through questions and check-ins.',
  },
];

const VOICE_NOT_AVAILABLE_NOTE = "Not available in this preview yet — your preference is saved for when it is.";

export const INTERACTION_METHOD_OPTIONS: {
  value: InteractionMethod;
  label: string;
  description: string;
  note?: string;
}[] = [
  { value: 'typed', label: 'Typed', description: 'Type your responses and goals.' },
  { value: 'voice', label: 'Voice', description: 'Speak your responses and goals.', note: VOICE_NOT_AVAILABLE_NOTE },
  {
    value: 'blend',
    label: 'Blend',
    description: 'Switch between typing and speaking anytime.',
    note: VOICE_NOT_AVAILABLE_NOTE,
  },
];
