/**
 * Printable handout: a true A4 sheet previewed in a sandboxed frame (no scripts, no same origin),
 * with language (her packs, or AI translation) and paper (A4 or US Letter, colour or black and
 * white) chosen beside it. Printing opens the same HTML as a blob in a new window.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download01, Printer, Stars02 } from '@untitledui/icons';
import type { CarePlan, LanguageCode, Mother } from '../types';
import { useApp, useWorker } from '../store';
import { COUNTRIES, LANGUAGE_NAMES } from '../data';
import { renderHandoutHTML } from '../illustrations';
import { isPackCode, renderMotherText, summarisePack } from '../i18n';
import { Button } from '../components/base/buttons/button';
import { Badge } from '../components/base/badges/badges';
import { Thinking, useAbort, useToast } from './components';
import { AIBadge, getProvider, useAIStatus, WhatAISees } from './ai';
import { withoutTitle } from './format';
import { Panel, StepHead } from './messages/Panel';
import { Segmented } from './messages/kit';

type Downloads = { save: (a: { filename: string; data: string | Blob }) => Promise<unknown> };
type ClaudeRT = { use?: (name: string) => Promise<unknown> };

export async function saveFile(filename: string, data: string, mime: string): Promise<'saved' | 'fallback' | 'declined'> {
  try {
    const claude = (window as unknown as { claude?: ClaudeRT }).claude;
    const dl = (await claude?.use?.('downloads')) as Downloads | null | undefined;
    if (dl && typeof dl.save === 'function') {
      try {
        await dl.save({ filename, data });
        return 'saved';
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === 'declined') return 'declined';
      }
    }
  } catch {
    /* fall through */
  }
  try {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    /* nothing more we can do */
  }
  return 'fallback';
}

type Paper = 'a4' | 'letter';
type Ink = 'colour' | 'mono';
// Page widths in CSS pixels at 96 dpi: A4 210 mm, Letter 8.5 in. Heights follow the paper ratio.
const PAGE: Record<Paper, { w: number; h: number; css: string }> = {
  a4: { w: 794, h: 1123, css: 'A4' },
  letter: { w: 816, h: 1056, css: 'letter' },
};

/** Paper size and ink: added as a style block, so the escaped, script-free handout stays as rendered. */
function withPaper(html: string, paper: Paper, ink: Ink): string {
  const extra = `<style>@page{size:${PAGE[paper].css};}${paper === 'letter' ? '@media screen{.sheet{width:8.5in!important}}' : ''}${
    ink === 'mono' ? 'html{filter:grayscale(1)}' : ''
  }</style>`;
  return html.includes('</head>') ? html.replace('</head>', `${extra}</head>`) : html + extra;
}

export function HandoutSheet({ mother, plan, itemIds, onClose }: { mother: Mother; plan: CarePlan; itemIds?: string[]; onClose: () => void }) {
  const { state } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const status = useAIStatus();
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [paper, setPaper] = useState<Paper>('a4');
  const [ink, setInk] = useState<Ink>('colour');
  const page = PAGE[paper];
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 40) / page.w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [page.w]);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [translated, setTranslated] = useState<Record<string, string> | undefined>();
  const [source, setSource] = useState<'english' | 'pack' | 'ai'>('english');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const { start, stop } = useAbort();
  const country = COUNTRIES[mother.country];
  const facility = state.facilities.find((f) => f.id === mother.facilityId);
  const items = useMemo(() => {
    const active = plan.items.filter((i) => i.status === 'active');
    if (itemIds && itemIds.length) return active.filter((i) => itemIds.includes(i.id));
    return active.filter((i) => i.audience !== 'worker').sort((a, b) => a.priority - b.priority).slice(0, 8);
  }, [plan.items, itemIds]);

  const html = useMemo(() => {
    let raw: string;
    try {
      raw = renderHandoutHTML({
        mother,
        plan,
        items,
        language,
        translated,
        brandName: 'Gaskin',
        workerName: withoutTitle(worker.name),
        facilityName: facility?.name,
        emergencyLine: country?.emergencyLine,
      });
    } catch {
      const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      raw = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui;padding:32px"><h1>Care plan for ${esc(mother.name.split(' ')[0])}</h1><ul>${items.map((i) => `<li>${esc(i.motherText)}</li>`).join('')}</ul></body></html>`;
    }
    return withPaper(raw, paper, ink);
  }, [mother, plan, items, language, translated, worker.name, facility?.name, country?.emergencyLine, paper, ink]);

  // The preview shows the sheet edge to edge at its true page width; the download keeps its own frame.
  const preview = useMemo(
    () => html.replace('</head>', '<style>@media screen{body{padding:0!important;background:none!important}.sheet{box-sizing:border-box;box-shadow:none!important;margin:0!important;width:100%!important;min-height:100vh}}</style></head>'),
    [html],
  );

  const languages = Array.from(new Set(['en' as LanguageCode, mother.language, ...(country?.languages ?? [])]));
  const packFor = (l: LanguageCode) => {
    if (l === 'en' || !isPackCode(l)) return null;
    try {
      const s = summarisePack(l);
      return s.motherCoverage > 0 ? s : null;
    } catch {
      return null;
    }
  };

  /** Her language from the offline pack: every item with a template key, else English for that line. */
  const fromPack = (lang: LanguageCode) => {
    const out: Record<string, string> = {};
    let n = 0;
    for (const i of items) {
      if (!i.motherTextKey) continue;
      try {
        const r = renderMotherText(i.motherTextKey, i.motherTextParams ?? {}, lang);
        if (r.confidence !== 'fallback') {
          out[i.id] = r.text;
          n += 1;
        }
      } catch {
        /* keep English for this line */
      }
    }
    return { out, n };
  };

  const choose = async (lang: LanguageCode) => {
    setNote('');
    if (lang === 'en') {
      setLanguage('en');
      setTranslated(undefined);
      setSource('english');
      return;
    }
    if (packFor(lang)) {
      const { out, n } = fromPack(lang);
      setLanguage(lang);
      setTranslated(out);
      setSource('pack');
      setNote(n < items.length ? `${items.length - n} of ${items.length} lines are not in the ${LANGUAGE_NAMES[lang]} pack yet, so they stay in English.` : '');
      return;
    }
    if (status.provider === 'none') {
      setNote(`${LANGUAGE_NAMES[lang] ?? lang} is coming soon. Switch AI on in Settings to translate it now, or print in English.`);
      return;
    }
    await translateAI(lang);
  };

  const translateAI = async (lang: LanguageCode) => {
    const signal = start();
    setBusy(true);
    try {
      const p = await getProvider();
      const texts: Record<string, string> = {};
      for (const i of items) {
        texts[i.id] = i.motherText;
        texts[`${i.id}.title`] = i.title;
      }
      const out = await p.translate({ texts, language: lang, signal, mother, plan, channel: 'print' });
      if (!signal.aborted) {
        setTranslated(out);
        setLanguage(lang);
        setSource('ai');
      }
    } catch {
      if (!signal.aborted) setNote('Translation is not available just now. The handout stays in English.');
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    // Print from a blob window: the preview frame has neither scripts nor same-origin access.
    try {
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const w = window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (!w) throw new Error('blocked');
      toast('The handout opened in a new tab. Use Print there.');
    } catch {
      toast('Printing is blocked here. Download the handout and print it from your phone or computer.');
    }
  };

  const download = async () => {
    const name = `gaskin-handout-${mother.name.split(' ')[0].toLowerCase()}-${language}-${paper}.html`;
    const r = await saveFile(name, html, 'text/html');
    toast(r === 'declined' ? 'Download cancelled.' : 'Handout ready to save.');
  };

  return (
    <Panel
      title="Printable handout"
      subtitle={`${items.length} item${items.length === 1 ? '' : 's'} with pictures, for ${mother.name.split(' ')[0]}`}
      onClose={onClose}
      label="Printable handout"
      width="xl"
      testId="handout"
      footer={
        <>
          <Button color="secondary" iconLeading={Download01} onClick={download}>
            Download
          </Button>
          <Button color="primary" iconLeading={Printer} onClick={print} data-testid="print-handout">
            Print
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <section>
            <StepHead title="Language" aside={<AIBadge />} />
            <ul className="grid gap-1.5" role="radiogroup" aria-label="Handout language">
              {languages.map((l) => {
                const pk = packFor(l);
                const on = language === l;
                const tag = l === 'en' ? 'Reviewed' : pk ? (pk.status === 'reviewed' ? 'Reviewed' : 'Offline draft') : status.provider === 'none' ? 'Coming soon' : 'AI translation';
                return (
                  <li key={l}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={busy}
                      onClick={() => void choose(l)}
                      data-lang={l}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-start text-sm ring-1 transition disabled:cursor-wait ${on ? 'bg-brand-primary ring-brand' : 'bg-primary ring-secondary hover:bg-primary_hover'}`}
                    >
                      <span className="font-medium text-primary">
                        {LANGUAGE_NAMES[l] ?? l}
                        {l === mother.language ? <span className="ml-1 text-xs font-normal text-tertiary">(hers)</span> : null}
                      </span>
                      <Badge size="sm" color={tag === 'Reviewed' ? 'success' : tag === 'Coming soon' ? 'gray' : tag === 'AI translation' ? 'brand' : 'warning'}>
                        {tag}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
            {busy ? (
              <div className="mt-3">
                <Thinking
                  label="Translating…"
                  onStop={() => {
                    stop();
                    setBusy(false);
                  }}
                />
              </div>
            ) : null}
            {note ? <p className="mt-3 text-sm text-tertiary">{note}</p> : null}
            {source === 'ai' ? (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-tertiary">
                <Stars02 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> Translated by AI. Read it with her before she takes it home.
              </p>
            ) : null}
          </section>
          <section>
            <StepHead title="Paper" />
            <div className="grid gap-2">
              <Segmented
                label="Paper size"
                value={paper}
                onChange={setPaper}
                options={[
                  { id: 'a4', label: 'A4' },
                  { id: 'letter', label: 'US Letter' },
                ]}
              />
              <Segmented
                label="Ink"
                value={ink}
                onChange={setInk}
                options={[
                  { id: 'colour', label: 'Colour' },
                  { id: 'mono', label: 'Black and white' },
                ]}
              />
            </div>
          </section>
          <WhatAISees task="translate" args={{ texts: Object.fromEntries(items.map((i) => [i.id, i.motherText])), language: mother.language, mother, plan }} />
        </div>

        <div ref={wrap} className="min-w-0 overflow-hidden rounded-xl bg-tertiary p-5 ring-1 ring-secondary" style={{ height: Math.round(page.h * scale) + 40 }}>
          <div style={{ width: page.w * scale, height: page.h * scale }} className="mx-auto overflow-hidden rounded-sm shadow-lg ring-1 ring-primary">
            <iframe
              className="handout-frame block border-0"
              title="Handout preview"
              sandbox=""
              srcDoc={preview}
              style={{ width: page.w, height: page.h, transform: `scale(${scale})`, transformOrigin: '0 0' }}
              data-testid="handout-frame"
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
