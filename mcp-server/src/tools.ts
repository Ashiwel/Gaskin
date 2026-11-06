/**
 * MCP tool definitions. Descriptions are written for the assistant: what the
 * tool is for, when to use it, and the rules it must follow with the worker.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SYMPTOM_LABELS } from '../../src/clinical';
import type { SymptomCode } from '../../src/types';
import { Gaskin, ToolError, type ToolResult } from './gaskin';
import type { DataStore } from './store';

export const SERVER_NAME = 'gaskin';
export const SERVER_VERSION = '0.1.0';

export const INSTRUCTIONS = `Gaskin is a continuity-of-care planner used by midwives and community health workers, from pregnancy to a child's first 1,000 days. You are helping one health worker with her caseload.

How to work:
- Start with gaskin_whoami, then gaskin_list_caseload ("who should I see next?").
- Mothers are identified by tokens such as M-7F3A. Use the token in every call. Do not ask for or guess names, phone numbers or places; the worker knows who each token is in her own app.
- Plans come from WHO and national guideline rules. Do not change doses, invent medicines, or tell a mother to stop a treatment. Explain items with gaskin_explain_rule.
- Emergency and urgent alerts come first. Say plainly what to do now. Alerts cannot be dismissed.
- To record something, call gaskin_record_observation without confirmation first, read the preview back to the worker, and only call again with confirmedByWorker: true after she says yes.
- gaskin_draft_message drafts words for the mother. It never sends. The worker checks and sends it from Gaskin.
- Use plain words. Many workers read English as a second language.`;

/** Every number an assistant sends must be a real, finite number (no NaN, Infinity or 1e308) */
const num = () => z.number().finite();
// Length-capped here; anything that is not a known token is refused (and audited) by the handler
const TOKEN = z.string().min(3).max(40).describe('The mother\'s token from gaskin_list_caseload, for example "M-7F3A".');
const SCOPE = z
  .enum(['mine', 'facility', 'all'])
  .optional()
  .describe('Whose mothers: "mine" (assigned to this worker, the default), "facility" (everyone at her facility) or "all" (everyone in the file).');

const SYMPTOM_CODES = Object.keys(SYMPTOM_LABELS) as [SymptomCode, ...SymptomCode[]];

const LANGS = ['en', 'pcm', 'ha', 'yo', 'ig', 'sw', 'tw', 'bin', 'urh', 'ar', 'dag', 'luo', 'ee', 'ff'] as const;

export function createServer(store: DataStore, gaskin: Gaskin): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION, title: 'Gaskin' }, { instructions: INSTRUCTIONS });

  const run = (tool: string, motherArg: (a: Record<string, unknown>) => string | undefined, fn: (a: never) => ToolResult) => async (args: Record<string, unknown>) => {
    const head = gaskin.headline();
    let deid = true;
    try {
      deid = gaskin.deidentification().on;
    } catch {
      /* default on */
    }
    try {
      const r = fn(args as never);
      store.audit({ tool, mother: r.mother ?? safeToken(motherArg(args)), outcome: r.outcome, deidentified: deid });
      const body = JSON.stringify(r.data, null, 2);
      // Re-read the setting after the call in case the file changed under us.
      const firstLine = gaskin.headline();
      return { content: [{ type: 'text' as const, text: `${firstLine}\n${r.text ? `${r.text}\n` : ''}${body}` }] };
    } catch (e) {
      const msg = e instanceof ToolError ? e.message : `Gaskin could not do that: ${(e as Error).message}`;
      store.audit({ tool, mother: safeToken(motherArg(args)), outcome: 'error', deidentified: deid });
      return { isError: true, content: [{ type: 'text' as const, text: `${head}\n${msg}` }] };
    }
  };
  const noMother = () => undefined;
  const tokenArg = (a: Record<string, unknown>) => (typeof a.token === 'string' ? a.token : undefined);

  server.registerTool(
    'gaskin_whoami',
    {
      title: 'Who am I in Gaskin',
      description:
        'Shows the health worker this assistant is helping, her facility, how many mothers and open alerts she has, the Gaskin settings, and whether de-identification is on. Call this first in a conversation.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    run('gaskin_whoami', noMother, () => gaskin.whoami()),
  );

  server.registerTool(
    'gaskin_list_caseload',
    {
      title: 'Who to see next',
      description:
        'Ranked list of the worker\'s mothers: who to see or call next and why. Emergencies and urgent alerts come first, then danger signs reported by message, then a contact-priority score (overdue visits, the first week after birth, high risk, long silence). Each mother is a token (M-7F3A) with an age band and a stage; no names, phone numbers or places.',
      inputSchema: {
        scope: SCOPE,
        limit: z.number().int().min(1).max(100).optional().describe('How many mothers to return (default 10).'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    run('gaskin_list_caseload', noMother, (a: { scope?: 'mine' | 'facility' | 'all'; limit?: number }) => gaskin.listCaseload(a)),
  );

  server.registerTool(
    'gaskin_get_care_plan',
    {
      title: 'Her care plan',
      description:
        'One mother\'s current care plan: journey stage, open alerts with what to do now, risks, every active plan item with the reasons it is there ("because"), its evidence grade and sources, whether it is locked, and her next contact. Written for the health worker.',
      inputSchema: {
        token: TOKEN,
        includeMotherText: z.boolean().optional().describe('Also include the short plain-language line for the mother on each item.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    run('gaskin_get_care_plan', tokenArg, (a: { token: string; includeMotherText?: boolean }) => gaskin.getCarePlan(a)),
  );

  server.registerTool(
    'gaskin_record_observation',
    {
      title: 'Record an observation',
      description:
        'Adds one observation to a mother\'s record: vitals (blood pressure, weight, temperature, pulse, fundal height, fetal heart rate, MUAC), symptoms, a lab result, a screening score (EPDS, PHQ-9, PHQ-2), breastfeeding/feeding, or the baby\'s growth. Without confirmedByWorker: true it only returns a preview and saves nothing. Always show the preview to the worker and ask before confirming. When saved, returns how her plan changed and any new alerts (for example a raised blood pressure). It never deletes or edits earlier records.',
      inputSchema: {
        token: TOKEN,
        kind: z.enum(['vitals', 'symptoms', 'lab', 'screening', 'feeding', 'growth']).describe('What kind of observation.'),
        about: z.enum(['mother', 'baby']).optional().describe('Whose observation. Default: baby for feeding and growth, mother otherwise. Baby means her youngest child.'),
        daysAgo: z.number().int().min(0).max(60).optional().describe('When it was observed, in days before today (0 = today, the default).'),
        vitals: z
          .object({
            systolic: num().optional().describe('Top BP number, mmHg'),
            diastolic: num().optional().describe('Bottom BP number, mmHg'),
            weightKg: num().optional(),
            temperatureC: num().optional(),
            pulse: num().optional(),
            fundalHeightCm: num().optional(),
            fetalHeartRate: num().optional(),
            muacCm: num().optional(),
          })
          .optional()
          .describe('For kind "vitals".'),
        symptoms: z
          .object({
            codes: z.array(z.enum(SYMPTOM_CODES)).min(1).max(20).describe(`Symptom codes: ${SYMPTOM_CODES.join(', ')}.`),
            severity: z.enum(['mild', 'moderate', 'severe']).optional(),
            via: z.enum(['visit', 'sms', 'whatsapp', 'voice', 'worker_call']).optional().describe('How it was reported (default visit).'),
          })
          .optional()
          .describe('For kind "symptoms".'),
        lab: z
          .object({
            test: z.enum(['haemoglobin', 'hiv', 'syphilis', 'hepatitis_b', 'malaria_rdt', 'urine_protein', 'urine_glucose', 'blood_glucose_fasting', 'ogtt_2h', 'genotype', 'blood_group', 'ultrasound']),
            value: z.union([num(), z.string().max(80)]).describe('Number (haemoglobin g/dL, glucose mmol/L, urine protein 0-3) or "positive"/"negative"/text.'),
            unit: z.string().max(20).optional(),
          })
          .optional()
          .describe('For kind "lab".'),
        screening: z
          .object({
            instrument: z.enum(['epds', 'phq9', 'phq2']),
            score: z.number().int().min(0).max(30),
            selfHarmFlag: z.boolean().optional().describe('EPDS question 10 (thoughts of self-harm) answered positively.'),
          })
          .optional()
          .describe('For kind "screening".'),
        feeding: z
          .object({
            status: z.enum(['exclusive_breastfeeding', 'mixed', 'formula', 'complementary_with_breastmilk', 'complementary_no_breastmilk']),
            milkSupply: z.enum(['good', 'low', 'very_low']).optional(),
            feedsPerDay: num().optional(),
            latchProblem: z.boolean().optional(),
          })
          .optional()
          .describe('For kind "feeding".'),
        growth: z
          .object({ weightKg: num().optional(), lengthCm: num().optional(), muacCm: num().optional(), headCircumferenceCm: num().optional() })
          .optional()
          .describe('For kind "growth" (the baby).'),
        note: z.string().max(500).optional().describe('Short clinical note. Do not include names, phone numbers or places.'),
        confirmedByWorker: z.boolean().optional().describe('Set true only after the worker has seen the preview and said yes. Otherwise nothing is saved.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    run('gaskin_record_observation', tokenArg, (a: Parameters<Gaskin['recordObservation']>[0]) => gaskin.recordObservation(a)),
  );

  server.registerTool(
    'gaskin_draft_message',
    {
      title: 'Draft a message to her',
      description:
        'Drafts a short message for the mother from Gaskin\'s reviewed templates, in her language where a language pack exists and plain English otherwise, for her best channel (SMS, WhatsApp, voice or a printed sheet). It never sends anything: the worker checks the draft and sends it from Gaskin. Placeholders such as [MOTHER] are filled in on the worker\'s device.',
      inputSchema: {
        token: TOKEN,
        channel: z.enum(['sms', 'whatsapp', 'email', 'voice', 'print']).optional().describe('Leave empty to use the channel Gaskin recommends for her phone and literacy.'),
        language: z.enum(LANGS).optional().describe('Language code. Leave empty for her own language.'),
        itemIds: z.array(z.string().max(120)).max(30).optional().describe('Only these plan item ids (from gaskin_get_care_plan). Leave empty for the most important items.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    run('gaskin_draft_message', tokenArg, (a: Parameters<Gaskin['draftMessage']>[0]) => gaskin.draftMessage(a)),
  );

  server.registerTool(
    'gaskin_list_alerts',
    {
      title: 'Open alerts',
      description: 'Every open danger-sign alert across the worker\'s mothers, most serious first, with what to do now and why. Alerts cannot be dismissed from here.',
      inputSchema: {
        scope: SCOPE,
        minLevel: z.enum(['warning', 'urgent', 'emergency']).optional().describe('Lowest level to include (default warning, so everything).'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    run('gaskin_list_alerts', noMother, (a: Parameters<Gaskin['listAlerts']>[0]) => gaskin.listAlerts(a)),
  );

  server.registerTool(
    'gaskin_explain_rule',
    {
      title: 'Why is this in her plan',
      description:
        'Explains why one plan item or alert is in a mother\'s plan: the facts that triggered it, what to do, the evidence grade and what it means, the guideline sources with links, whether it is locked, and any change a health worker or approved rule made to it.',
      inputSchema: {
        token: TOKEN,
        itemId: z.string().min(2).max(120).describe('The item id (for example "med.iron_folate") or alert id (for example "alert.hypertension") from gaskin_get_care_plan. A title also works.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    run('gaskin_explain_rule', tokenArg, (a: { token: string; itemId: string }) => gaskin.explainRule(a)),
  );

  return server;
}

/** Only a well-formed token goes in the audit log, never free text an assistant typed. */
function safeToken(t: string | undefined): string | undefined {
  if (!t) return undefined;
  const s = t.trim().toUpperCase();
  return /^M-[0-9A-F]{4,12}$/.test(s) ? s : '(unrecognised)';
}

export const TOOL_SUMMARIES: Array<{ name: string; description: string }> = [
  { name: 'gaskin_whoami', description: 'The worker, her facility, settings, and whether de-identification is on.' },
  { name: 'gaskin_list_caseload', description: 'Who to see next, ranked, with reasons. Mothers appear as tokens.' },
  { name: 'gaskin_get_care_plan', description: 'One mother\'s plan: stage, alerts, items with reasons and evidence, next contact.' },
  { name: 'gaskin_record_observation', description: 'Record vitals, symptoms, a lab result, a screening score, feeding or growth. Preview first; saves only when the worker confirms.' },
  { name: 'gaskin_draft_message', description: 'Draft a message for the mother in her language. Never sends.' },
  { name: 'gaskin_list_alerts', description: 'Open danger-sign alerts, most serious first.' },
  { name: 'gaskin_explain_rule', description: 'Why an item or alert is in her plan, with sources.' },
];
