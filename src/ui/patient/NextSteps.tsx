/**
 * The "Next steps" page after a visit: built from her plan and the visit, shown in a preview
 * with a language switch, printed (sandboxed iframe), downloaded (inside the claude.ai viewer,
 * where printing is blocked) or sent as a short SMS or WhatsApp message.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download01, Printer, Send01 } from '@untitledui/icons';
import type { CarePlan, IllustrationKey, Mother, OutboundMessage, PlanItem } from '../../types';
import { stamp, uid, useApp, useWorker } from '../../store';
import { sendThroughBackend } from '../../store/backend';
import { COUNTRIES } from '../../data';
import { getLocationProfile } from '../../location';
import { LOCAL_FOODS } from '../../clinical';
import { estimateCost, smsSegments } from '../../messaging';
import { renderVisitSheetHTML, visitSheetText, type VisitSheetInput } from '../../illustrations/visitSheet';
import { Button } from '../../components/base/buttons/button';
import { artifactRuntime } from '../../hosted/runtime';
import { useToast } from '../components';
import { saveFile } from '../HandoutSheet';
import { fmtDate, withoutTitle } from '../format';
import { emergencyShort } from './adapters';
import { lineFor } from './lang';
import { LanguageSwitch, useLangs } from './MotherSide';
import { useHerPack } from './Header';
import { SideSheet } from './ui';

const DANGER_ILLUSTRATION: IllustrationKey[] = ['danger_bleeding', 'danger_headache', 'danger_fever', 'danger_convulsion', 'danger_baby_movement', 'danger_swelling', 'danger_breathing', 'baby_danger'];

/** Build the sheet input from her plan (and, after a visit, the next visit date chosen). */
export function nextStepsInput(mother: Mother, plan: CarePlan, opts: { lang: string; workerName?: string; facilityName?: string; nextDate?: string; nextLabel?: string; clock: string; children?: string[] }): VisitSheetInput {
  const active = plan.items.filter((i) => i.status === 'active' && i.audience !== 'worker' && !i.workerOnly);
  const mt = (i: Pick<PlanItem, 'motherText' | 'motherTextKey' | 'motherTextParams'>) => lineFor(opts.lang, i.motherTextKey, i.motherText, i.motherTextParams).text;
  const medicines = active
    .filter((i) => i.category === 'medication')
    .slice(0, 4)
    .map((i) => ({ name: i.title.replace(/^(Take|Give)\s+/i, ''), when: mt(i), perDay: /twice|two times|2 times/i.test(`${i.timing} ${i.motherText}`) ? 2 : 1, illustration: i.illustration ?? ('iron_tablet' as IllustrationKey) }));
  let foods: VisitSheetInput['foods'] = [];
  try {
    const prof = getLocationProfile(mother.country, mother.region);
    foods = prof.localFoods
      .filter((f) => f.costTier !== 'dear')
      .slice(0, 6)
      .map((f) => ({ name: f.name.split('(')[0].trim(), serving: f.householdMeasure }));
  } catch {
    /* fall back below */
  }
  if (!foods.length) foods = (LOCAL_FOODS[mother.country] ?? []).filter((f) => f.costTier === 'cheap').slice(0, 6).map((f) => ({ name: f.short ?? f.name, serving: f.serving }));
  const todo = active
    .filter((i) => i.howTo?.steps?.length && i.category !== 'medication')
    .slice(0, 3)
    .map((i) => ({ title: mt(i), steps: i.howTo!.steps.map((s, k) => lineFor(opts.lang, i.howTo!.stepKeys?.[k], s).text).slice(0, 5), illustration: i.howTo!.illustration ?? i.illustration }));
  const dangerItems = active.filter((i) => i.category === 'danger_signs');
  const dangerSigns: VisitSheetInput['dangerSigns'] = [];
  for (const i of dangerItems) if (i.illustration && DANGER_ILLUSTRATION.includes(i.illustration)) dangerSigns.push({ label: '', illustration: i.illustration });
  const defaults: IllustrationKey[] = plan.state.stage === 'pregnancy' ? ['danger_bleeding', 'danger_headache', 'danger_fever', 'danger_baby_movement', 'danger_convulsion'] : ['danger_bleeding', 'danger_fever', 'baby_danger', 'danger_breathing'];
  for (const k of defaults) if (!dangerSigns.some((d) => d.illustration === k)) dangerSigns.push({ label: '', illustration: k });
  const tests = [
    ...active.filter((i) => i.category === 'tests').map((i) => ({ name: mt(i), when: i.dueDate ? fmtDate(i.dueDate) : i.timing })),
    ...(plan.state.unknowns ?? []).map((u) => ({ name: u.test.replace(/_/g, ' '), when: u.action === 'refer_for_test' ? 'today' : 'at your next visit', where: opts.facilityName })),
  ].slice(0, 6);
  const next = opts.nextDate ?? plan.nextContact?.date;
  const s = plan.state;
  const stage = s.stage === 'pregnancy' ? `${s.gestationalWeeks ?? ''} weeks pregnant` : s.stage === 'postpartum' ? `Day ${s.daysPostpartum ?? 0} after birth` : s.stage === 'infant' ? 'Caring for your baby' : undefined;
  return {
    name: mother.name.split(' ')[0],
    children: opts.children,
    stage,
    language: opts.lang,
    visitDate: opts.clock.slice(0, 10),
    medicines,
    foods,
    todo,
    dangerSigns: dangerSigns.slice(0, 6),
    tests,
    nextVisit: next ? { date: next, label: opts.nextLabel ?? plan.nextContact?.label, place: opts.facilityName } : undefined,
    emergencyNumber: emergencyShort(mother.country),
    workerName: opts.workerName,
    facilityName: opts.facilityName,
    brandName: 'Gaskin',
  };
}

export function NextStepsSheet({ mother, plan, onClose, nextDate, nextLabel, childNames }: { mother: Mother; plan: CarePlan; onClose: () => void; nextDate?: string; nextLabel?: string; childNames?: string[] }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const { ml } = useLangs(mother);
  useHerPack(mother.language);
  const [lang, setLang] = useState<string>(ml);
  const [paper, setPaper] = useState<'A4' | 'Letter'>('A4');
  const facility = state.facilities.find((f) => f.id === mother.facilityId)?.name;
  const input = useMemo(
    () => ({ ...nextStepsInput(mother, plan, { lang, workerName: withoutTitle(worker.name), facilityName: facility, nextDate, nextLabel, clock: state.clock, children: childNames }), paper }),
    [mother, plan, lang, worker.name, facility, nextDate, nextLabel, state.clock, childNames, paper],
  );
  const html = useMemo(() => renderVisitSheetHTML(input), [input]);
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const inViewer = Boolean(artifactRuntime());
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / 800));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const print = () => {
    try {
      const w = frame.current?.contentWindow;
      if (!w) throw new Error('no frame');
      w.focus();
      w.print();
    } catch {
      toast('Printing is blocked here. Download the page and print it from your phone or computer.');
    }
  };
  const download = async () => {
    const r = await saveFile(`gaskin-next-steps-${mother.name.split(' ')[0].toLowerCase()}-${lang}.html`, html, 'text/html');
    toast(r === 'declined' ? 'Download cancelled.' : 'Next steps page ready to save.');
  };
  const canSend = mother.consent.messaging && mother.phone.access !== 'none';
  const send = () => {
    const channel = mother.phone.hasWhatsApp ? 'whatsapp' : 'sms';
    const body = visitSheetText(input, channel === 'sms' ? 306 : 900);
    const now = stamp(state.clock);
    let cost = { local: 0, usd: 0 };
    try {
      cost = estimateCost(channel, body, COUNTRIES[mother.country]);
    } catch {
      /* cost unknown */
    }
    const msg: OutboundMessage = { id: uid('out'), motherId: mother.id, channel, language: (lang as OutboundMessage['language']) ?? 'en', body, segments: channel === 'sms' ? smsSegments(body) : undefined, estCostLocal: cost.local, estCostUSD: cost.usd, status: 'queued', createdAt: now, planVersion: plan.version, itemIds: [], aiAssisted: false, reviewedBy: worker.id };
    dispatch({ type: 'sendMessage', message: msg, meta: { recipient: 'mother', number: mother.phone.number, times: { queued: now } } });
    sendThroughBackend({ message: msg, recipient: 'mother' });
    toast(`Sent by ${channel === 'sms' ? 'SMS' : 'WhatsApp'}.`);
  };

  return (
    <SideSheet
      title="Next steps for her"
      subtitle="A page in her language, led by pictures, to take home."
      onClose={onClose}
      width="xl"
      testId="next-steps"
      footer={
        <>
          {canSend ? (
            <Button size="md" color="secondary" iconLeading={Send01} onClick={send} className="mr-auto">
              Send as message
            </Button>
          ) : null}
          <Button size="md" color={inViewer ? 'primary' : 'secondary'} iconLeading={Download01} onClick={download}>
            Download
          </Button>
          {!inViewer ? (
            <Button size="md" color="primary" iconLeading={Printer} onClick={print}>
              Print
            </Button>
          ) : null}
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LanguageSwitch value={lang} onChange={setLang} motherLang={mother.language} country={mother.country} />
        <select value={paper} onChange={(e) => setPaper(e.target.value as 'A4' | 'Letter')} aria-label="Paper size" className="min-h-9 rounded-lg px-2.5 text-sm font-semibold text-primary ring-1 ring-primary ring-inset">
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
        </select>
        {inViewer ? <span className="text-xs text-tertiary">Printing is blocked in this viewer. Download the page and print it.</span> : null}
      </div>
      <div ref={wrap} className="overflow-hidden rounded-xl ring-1 ring-secondary" style={{ height: Math.round(1130 * scale) }}>
        <iframe ref={frame} title="Next steps preview" sandbox="allow-modals allow-same-origin" srcDoc={html} style={{ width: 800, height: 1130, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0, background: 'white' }} />
      </div>
    </SideSheet>
  );
}
