/**
 * The conversation on her phone, built from the outbound and inbound records, and canned replies
 * in her language for the demo. Each message carries its own lang and dir so Arabic reads right
 * to left inside an otherwise left-to-right screen.
 */
import type { Channel, LanguageCode, Mother } from '../../types';
import type { AppState } from '../../store';
import { fmtDate, fmtTime, daysBetween } from '../format';

export interface ThreadMessage {
  id: string;
  at: string;
  from: 'clinic' | 'her';
  kind: 'text' | 'call';
  body: string;
  channel: Channel;
  lang: string;
  dir: 'ltr' | 'rtl';
  status?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'draft';
  time: string;
  dayLabel: string;
}

const RTL = new Set(['ar']);
/** Text direction from the characters themselves (a mother may type Arabic in any setting). */
export function dirOfText(text: string, fallback: 'ltr' | 'rtl' = 'ltr'): 'ltr' | 'rtl' {
  const m = text.match(/[֐-ࣿיִ-﷿ﹰ-﻿]|[A-Za-zÀ-ɏ]/);
  if (!m) return fallback;
  return /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(m[0]) ? 'rtl' : 'ltr';
}
export function dirOfLang(lang: string): 'ltr' | 'rtl' {
  return RTL.has(lang) ? 'rtl' : 'ltr';
}

export function dayLabel(at: string, clock: string): string {
  const n = daysBetween(at, clock);
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  return fmtDate(at, { weekday: false });
}

/** Messages delivered to her own phone (not email, not printed, not to a family carer). */
export function threadFor(state: AppState, mother: Mother): ThreadMessage[] {
  const out: ThreadMessage[] = state.outbound
    .filter((o) => o.motherId === mother.id && o.channel !== 'email' && o.channel !== 'print' && state.messageMeta[o.id]?.recipient !== 'carer')
    .filter((o) => o.status !== 'draft')
    .map((o) => {
      const at = o.sentAt ?? o.createdAt;
      const call = o.channel === 'voice';
      return {
        id: o.id,
        at,
        from: 'clinic' as const,
        kind: call ? ('call' as const) : ('text' as const),
        body: call ? 'Voice call from the clinic' : o.body,
        channel: o.channel,
        lang: o.language,
        dir: call ? 'ltr' : dirOfText(o.body, dirOfLang(o.language)),
        status: o.status,
        time: fmtTime(at),
        dayLabel: dayLabel(at, state.clock),
      };
    });
  const inb: ThreadMessage[] = state.inbound
    .filter((i) => i.motherId === mother.id)
    .map((i) => ({
      id: i.id,
      at: i.receivedAt,
      from: 'her' as const,
      kind: 'text' as const,
      body: i.body,
      channel: i.channel,
      lang: mother.language,
      dir: dirOfText(i.body, dirOfLang(mother.language)),
      status: 'delivered' as const,
      time: fmtTime(i.receivedAt),
      dayLabel: dayLabel(i.receivedAt, state.clock),
    }));
  return [...out, ...inb].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Canned replies, in her language where the parser knows the words, plus English and Pidgin. */
export interface Canned {
  text: string;
  lang: string;
  gist: string;
  tone: 'danger' | 'concern' | 'fine';
}

const BY_LANG: Partial<Record<LanguageCode, Canned[]>> = {
  ha: [
    { text: 'Ina da ciwon kai sosai, kuma kafafuna sun yi kumburi', lang: 'ha', gist: 'Bad headache and swollen feet', tone: 'danger' },
    { text: 'Ina da zazzabi tun jiya', lang: 'ha', gist: 'Fever since yesterday', tone: 'concern' },
    { text: 'Na gode, zan zo asibiti ranar Alhamis', lang: 'ha', gist: 'Thank you, I will come on Thursday', tone: 'fine' },
  ],
  yo: [
    { text: 'Orififo n se mi gan, ese mi si ti wu (ewiwu)', lang: 'yo', gist: 'Bad headache and swelling', tone: 'danger' },
    { text: 'Iba n se mi lati ana', lang: 'yo', gist: 'Fever since yesterday', tone: 'concern' },
    { text: 'E se, maa wa si ile iwosan ni Ojobo', lang: 'yo', gist: 'Thank you, I will come on Thursday', tone: 'fine' },
  ],
  ig: [
    { text: 'Isi na awa m nke ukwuu, ukwu m azaala', lang: 'ig', gist: 'Bad headache, swollen legs', tone: 'danger' },
    { text: 'Daalụ, aga m abịa ụlọ ọgwụ na Tọzdee', lang: 'ig', gist: 'Thank you, I will come on Thursday', tone: 'fine' },
  ],
  sw: [
    { text: 'Nina maumivu ya kichwa makali na miguu inavimba (kuvimba)', lang: 'sw', gist: 'Bad headache and swelling', tone: 'danger' },
    { text: 'Nina homa tangu jana', lang: 'sw', gist: 'Fever since yesterday', tone: 'concern' },
    { text: 'Asante, nitakuja kliniki Alhamisi', lang: 'sw', gist: 'Thank you, I will come on Thursday', tone: 'fine' },
  ],
  tw: [
    { text: 'Me ti pae me yiye, me nan ahonhon (ahoninam)', lang: 'tw', gist: 'Bad headache and swollen feet', tone: 'danger' },
    { text: 'Medaase, mɛba ayaresabea Yawda', lang: 'tw', gist: 'Thank you, I will come on Thursday', tone: 'fine' },
  ],
  ar: [
    { text: 'عندي صداع شديد ورجلي منتفخة', lang: 'ar', gist: 'Bad headache, swollen leg (Gaskin may not read Arabic yet)', tone: 'danger' },
    { text: 'شكرا، سآتي إلى العيادة يوم الخميس', lang: 'ar', gist: 'Thank you, I will come on Thursday', tone: 'fine' },
  ],
};

const COMMON: Canned[] = [
  { text: 'My head dey bang me and my leg don swell', lang: 'pcm', gist: 'Bad headache and swelling', tone: 'danger' },
  { text: 'Belle dey pain me well well and blood dey come', lang: 'pcm', gist: 'Belly pain and bleeding', tone: 'danger' },
  { text: 'The baby no gree suck breast since morning and body hot', lang: 'pcm', gist: 'Baby not feeding, hot body', tone: 'danger' },
  { text: 'I have been feeling very sad and I cannot sleep', lang: 'en', gist: 'Low mood, no sleep', tone: 'concern' },
  { text: 'Thank you ma, I go come for the clinic', lang: 'pcm', gist: 'Thank you, I will come', tone: 'fine' },
  { text: 'Thank you. I took my tablets today', lang: 'en', gist: 'Took her tablets', tone: 'fine' },
];

export function cannedFor(lang: LanguageCode): Canned[] {
  const own = BY_LANG[lang] ?? [];
  return [...own, ...COMMON.filter((c) => !own.some((o) => o.gist === c.gist))].slice(0, 7);
}
