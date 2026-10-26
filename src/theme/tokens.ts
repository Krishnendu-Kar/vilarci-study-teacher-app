// ─────────────────────────────────────────────────────────────────────────────
// Vilarci Study — "Porcelain & Wine" design language
//
// A premium, native-feeling mobile system: warm porcelain canvas, deep wine as
// a jewel accent (not a flat fill), antique gold for honours, and generous
// radii with soft layered elevation. Deliberately NOT the website's look —
// only the data model is shared with the web prototype.
// ─────────────────────────────────────────────────────────────────────────────

export interface SubjectTone {
  base: string;
  bg: string;
  border: string;
  text: string;
}

export interface Palette {
  // Jewel accents
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primarySubtle: string;
  gold: string;
  goldBright: string;
  goldSubtle: string;

  // Status
  success: string;
  successBg: string;
  successText: string;
  warning: string;
  warningBg: string;
  warningText: string;
  error: string;
  errorBg: string;
  errorText: string;
  info: string;
  infoBg: string;
  infoText: string;

  // Canvas & surfaces
  bgApp: string;
  surface: string;
  surfaceRaised: string;
  surfaceMuted: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;

  // Type
  textMain: string;
  textSecondary: string;
  textMuted: string;
  textOnDark: string;
  textOnPrimary: string;

  // Gradients
  heroGradient: [string, string, string];
  goldGradient: [string, string];
  primaryGradient: [string, string];

  subjects: Record<string, SubjectTone>;

  scrim: string;
  shadowColor: string;
  /** Opacity applied to card shadows in this scheme. */
  shadowOpacity: number;

  // Back-compat aliases used by a few call sites
  accent: string;
  accentSubtle: string;
}

const lightSubjects: Record<string, SubjectTone> = {
  maths: { base: '#3A5BA8', bg: '#EDF1FA', border: '#D4DEF2', text: '#2E4A8C' },
  physics: { base: '#6B4FC4', bg: '#F2EFFC', border: '#DFD7F5', text: '#55399F' },
  chemistry: { base: '#0F7D73', bg: '#E8F6F4', border: '#C9E9E4', text: '#0B655D' },
  biology: { base: '#2E7D4F', bg: '#EAF5EE', border: '#CDE7D7', text: '#246340' },
  english: { base: '#C2622A', bg: '#FBF0E8', border: '#F2DAC7', text: '#9E4F20' },
  default: { base: '#6E0A26', bg: '#FBEEF1', border: '#F0D8DE', text: '#6E0A26' },
};

const darkSubjects: Record<string, SubjectTone> = {
  maths: { base: '#7E9BE0', bg: 'rgba(126,155,224,0.14)', border: 'rgba(126,155,224,0.26)', text: '#9DB4E9' },
  physics: { base: '#A98FE8', bg: 'rgba(169,143,232,0.14)', border: 'rgba(169,143,232,0.26)', text: '#BCA8EE' },
  chemistry: { base: '#4FC2B5', bg: 'rgba(79,194,181,0.14)', border: 'rgba(79,194,181,0.26)', text: '#6ED2C6' },
  biology: { base: '#5FC087', bg: 'rgba(95,192,135,0.14)', border: 'rgba(95,192,135,0.26)', text: '#7FD09F' },
  english: { base: '#E0935F', bg: 'rgba(224,147,95,0.14)', border: 'rgba(224,147,95,0.26)', text: '#EAA87B' },
  default: { base: '#C96B84', bg: 'rgba(201,107,132,0.14)', border: 'rgba(201,107,132,0.26)', text: '#D98EA3' },
};

export const lightPalette: Palette = {
  primary: '#6E0A26',
  primaryPressed: '#55071D',
  primarySoft: '#8E1437',
  primarySubtle: '#FBEEF1',
  gold: '#B8902F',
  goldBright: '#E0B858',
  goldSubtle: '#FBF3E2',

  success: '#0E7A5F',
  successBg: '#E7F5F0',
  successText: '#0A5F4A',
  warning: '#B4761A',
  warningBg: '#FBF1E3',
  warningText: '#8E5B10',
  error: '#B3261E',
  errorBg: '#FBEAE8',
  errorText: '#8E1D17',
  info: '#1D5C92',
  infoBg: '#E9F1F8',
  infoText: '#174A76',

  bgApp: '#FAF8F6',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#F4F1ED',
  surfaceAlt: '#EAE5DF',
  border: '#EBE6DF',
  borderStrong: '#DCD5CC',

  textMain: '#16110F',
  textSecondary: '#5A524D',
  textMuted: '#948A83',
  textOnDark: '#FDFBF9',
  textOnPrimary: '#FFFFFF',

  heroGradient: ['#2A0712', '#6E0A26', '#8E1437'],
  goldGradient: ['#B8902F', '#E0B858'],
  primaryGradient: ['#6E0A26', '#8E1437'],

  subjects: lightSubjects,
  scrim: 'rgba(22, 17, 15, 0.42)',
  shadowColor: '#2A1118',
  shadowOpacity: 0.07,

  accent: '#B8902F',
  accentSubtle: '#FBF3E2',
};

export const darkPalette: Palette = {
  primary: '#B01C3E',
  primaryPressed: '#8E1431',
  primarySoft: '#C9405C',
  primarySubtle: 'rgba(176, 28, 62, 0.16)',
  gold: '#D9B36A',
  goldBright: '#EFD39B',
  goldSubtle: 'rgba(217, 179, 106, 0.14)',

  success: '#2DA584',
  successBg: 'rgba(45, 165, 132, 0.15)',
  successText: '#5FCBAC',
  warning: '#D9A14A',
  warningBg: 'rgba(217, 161, 74, 0.15)',
  warningText: '#E8BC79',
  error: '#D6504A',
  errorBg: 'rgba(214, 80, 74, 0.15)',
  errorText: '#E8827D',
  info: '#5296CC',
  infoBg: 'rgba(82, 150, 204, 0.15)',
  infoText: '#86B8DF',

  bgApp: '#0C0709',
  surface: '#161013',
  surfaceRaised: '#1C1519',
  surfaceMuted: '#1F171B',
  surfaceAlt: '#2A2025',
  border: '#2C2328',
  borderStrong: '#3A2E34',

  textMain: '#F7F2F0',
  textSecondary: '#B6A9A4',
  textMuted: '#7E716B',
  textOnDark: '#F7F2F0',
  textOnPrimary: '#FFFFFF',

  heroGradient: ['#17060B', '#45101F', '#6E0A26'],
  goldGradient: ['#A8822A', '#D9B36A'],
  primaryGradient: ['#8E1431', '#B01C3E'],

  subjects: darkSubjects,
  scrim: 'rgba(4, 2, 3, 0.68)',
  shadowColor: '#000000',
  shadowOpacity: 0.5,

  accent: '#D9B36A',
  accentSubtle: 'rgba(217, 179, 106, 0.14)',
};

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 34,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const fonts = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  display: 'PlayfairDisplay_600SemiBold',
  displayBold: 'PlayfairDisplay_700Bold',
  // legacy aliases
  serif: 'PlayfairDisplay_600SemiBold',
  serifBold: 'PlayfairDisplay_700Bold',
} as const;

/** Soft layered elevation — premium apps keep shadows wide and faint. */
export function elevation(level: 0 | 1 | 2 | 3, color: string, opacity: number) {
  if (level === 0) return {};
  const map = {
    1: { radius: 10, y: 2, e: 2 },
    2: { radius: 20, y: 6, e: 5 },
    3: { radius: 34, y: 14, e: 10 },
  } as const;
  const m = map[level];
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: m.radius,
    shadowOffset: { width: 0, height: m.y },
    elevation: m.e,
  };
}

export function subjectKey(subject?: string | null): string {
  if (!subject) return 'default';
  const s = subject.toLowerCase();
  if (s.includes('math')) return 'maths';
  if (s.includes('physic')) return 'physics';
  if (s.includes('chem')) return 'chemistry';
  if (s.includes('bio')) return 'biology';
  if (s.includes('english') || s.includes('literature')) return 'english';
  return 'default';
}
