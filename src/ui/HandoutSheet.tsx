import { useEffect, useMemo, useRef, useState } from 'react';
import type { CarePlan, LanguageCode, Mother } from '../types';
import { useApp, useWorker } from '../store';
import { COUNTRIES, LANGUAGE_NAMES } from '../data';
import { renderHandoutHTML } from '../illustrations';
import { Sheet, Thinking, useAbort, useToast } from './components';
import { AIBadge, getProvider, WhatAISees } from './ai';
import { IDownload, IPrint, ITranslate } from './icons';
import { withoutTitle } from './format';

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

export function HandoutSheet({ mother, plan, itemIds, onClose }: { mother: Mother; plan: CarePlan; itemIds?: string[]; onClose: () => void }) {
  const { state } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Render the A4 page at its real width and scale it down to fit narrow screens.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / 820));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [translated, setTranslated] = useState<Record<string, string> | undefined>();
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
    try {
      return renderHandoutHTML({
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
      return `<!doctype html><html><body style="font-family:Georgia,serif;padding:32px"><h1>Care plan for ${mother.name.split(' ')[0]}</h1><ul>${items
        .map((i) => `<li>${i.motherText}</li>`)
        .join('')}</ul></body></html>`;
    }
  }, [mother, plan, items, language, translated, worker.name, facility?.name, country?.emergencyLine]);

  const translate = async (lang: LanguageCode) => {
    if (lang === 'en') {
      setLanguage('en');
      setTranslated(undefined);
      return;
    }
    const signal = start();
    setBusy(true);
    setNote('');
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
      }
    } catch {
      if (!signal.aborted) setNote('Translation is not available just now. The handout stays in English.');
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    try {
      const w = frame.current?.contentWindow;
      if (!w) throw new Error('no frame');
      w.focus();
      w.print();
    } catch {
      toast('Printing is blocked here. Download the handout and print it from your phone or computer.');
    }
  };

  const download = async () => {
    const name = `gaskin-handout-${mother.name.split(' ')[0].toLowerCase()}-${language}.html`;
    const r = await saveFile(name, html, 'text/html');
    toast(r === 'declined' ? 'Download cancelled.' : 'Handout ready to save.');
  };

  return (
    <Sheet
      wide
      title="Printable handout"
      onClose={onClose}
      label="Printable handout"
      footer={
        <>
          <button className="btn" onClick={download}>
            <IDownload /> Download
          </button>
          <button className="btn primary" onClick={print}>
            <IPrint /> Print
          </button>
        </>
      }
    >
      <div className="section-head">
        <p className="small soft">
          {items.length} item{items.length === 1 ? '' : 's'} with pictures, for mothers who prefer paper or share a phone.
        </p>
        <div className="btn-row">
          <AIBadge />
          <label className="field" style={{ minWidth: 200 }}>
            <span className="sr">Language</span>
            <select className="select" id="handout-lang" value={language} onChange={(e) => translate(e.target.value as LanguageCode)} disabled={busy}>
              {Array.from(new Set(['en' as LanguageCode, mother.language, ...(country?.languages ?? [])])).map((l) => (
                <option key={l} value={l}>
                  {l === 'en' ? 'English' : `Translate with AI: ${LANGUAGE_NAMES[l] ?? l}`}
                </option>
              ))}
            </select>
          </label>
          {mother.language !== 'en' && language === 'en' && !busy ? (
            <button className="btn small" onClick={() => translate(mother.language)}>
              <ITranslate /> Translate into {LANGUAGE_NAMES[mother.language]}
            </button>
          ) : null}
        </div>
      </div>
      {busy ? <Thinking label="Translating…" onStop={() => { stop(); setBusy(false); }} /> : null}
      {note ? <p className="small muted">{note}</p> : null}
      <WhatAISees task="translate" args={{ texts: Object.fromEntries(items.map((i) => [i.id, i.motherText])), language: mother.language, mother, plan }} />
      <div ref={wrap} className="handout-wrap" style={{ height: `calc(${Math.round(1160 * scale)}px)` }}>
        <iframe
          ref={frame}
          className="handout-frame"
          title="Handout preview"
          sandbox="allow-modals allow-same-origin"
          srcDoc={html}
          style={{ width: 820, height: 1160, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
      </div>
    </Sheet>
  );
}
