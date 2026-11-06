/**
 * The two navigation sets. Labels are English defaults: App.tsx passes them through useT().
 * Health-worker mode: Today, Mothers, Visits, Messages, Review, Insights, Library, Settings.
 * Personal mode (a mother using Gaskin for herself): My plan, My baby, Visits, Messages, Settings.
 */
import { BarChartSquare02, BookOpen01, CalendarCheck01, ClipboardCheck, Heart, HeartHand, Home03, InfoCircle, MessageChatCircle, Scales02, Settings01, Users01 } from '@untitledui/icons';
import type { NavEntry, NavKey } from './types';

export const WORKER_NAV: NavEntry[] = [
  { key: 'today', label: 'Today', icon: Home03, mobile: true },
  { key: 'mothers', label: 'Mothers', icon: Users01, mobile: true },
  { key: 'visits', label: 'Visits', icon: CalendarCheck01, mobile: true },
  { key: 'messages', label: 'Messages', icon: MessageChatCircle, mobile: true },
  { key: 'review', label: 'Review', icon: Scales02 },
  { key: 'insights', label: 'Insights', icon: BarChartSquare02 },
  { key: 'library', label: 'Library', icon: BookOpen01 },
  { key: 'settings', label: 'Settings', icon: Settings01, footer: true },
  { key: 'about', label: 'About', icon: InfoCircle, footer: true },
];

export const PERSONAL_NAV: NavEntry[] = [
  { key: 'my-plan', label: 'My plan', icon: ClipboardCheck, mobile: true },
  { key: 'my-baby', label: 'My baby', icon: HeartHand, mobile: true },
  { key: 'visits', label: 'Visits', icon: CalendarCheck01, mobile: true },
  { key: 'messages', label: 'Messages', icon: MessageChatCircle, mobile: true },
  { key: 'settings', label: 'Settings', icon: Settings01, footer: true },
  { key: 'about', label: 'About', icon: Heart, footer: true },
];

/** i18n keys for nav labels (fall back to the English label). */
export const NAV_T_KEY: Partial<Record<NavKey, string>> = {
  today: 'nav.today',
  mothers: 'nav.mothers',
  visits: 'nav.visits',
  messages: 'nav.messages',
  review: 'nav.review',
  insights: 'nav.insights',
  library: 'nav.library',
  settings: 'nav.settings',
  about: 'nav.about',
  'my-plan': 'nav.my_plan',
  'my-baby': 'nav.my_baby',
};
