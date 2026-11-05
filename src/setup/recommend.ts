/**
 * recommendSetup(answers, env) turns the onboarding answers into one working setup.
 *
 * The rules are deterministic and ordered: the first rule that matches wins, and every
 * choice carries a plain-English reason the worker sees on the summary screen.
 * Where an answer is missing or "Not sure", the rules assume the simpler, safer case:
 * patchy internet, some hours of power, low comfort with technology, no printer.
 *
 * Nothing here touches the browser. `env` (device facts) is passed in, so tests can
 * describe any device; src/setup/env.ts reads the real ones.
 */
import type { Channel, CountryCode, LanguageCode } from '../types';
import type { AISettings } from '../ai';
import { getLocationProfile, type LocationProfile } from '../location';
import type {
  AssistantTarget,
  Printer,
  SetupAIMode,
  SetupAnswers,
  SetupEnvironment,
  SetupPlan,
  StorageChoice,
  WorkerLanguage,
} from './types';

const COUNTRY_NAMES: Record<CountryCode, string> = { NG: 'Nigeria', KE: 'Kenya', GH: 'Ghana' };

/** Languages Gaskin can show its own screens in (others fall back to English) */
const UI_LANGUAGES = new Set<string>(['en', 'pcm', 'ha', 'yo', 'ig', 'sw', 'tw', 'fr']);

/** Where most mothers have smartphones (DHS/KDHS: Lagos 72% internet use, Nairobi 72% smartphones, Greater Accra 88% literacy) */
const WHATSAPP_FIRST_REGIONS = new Set(['Lagos', 'Nairobi', 'Greater Accra']);

/** Where many mothers do not read, so voice notes and calls matter (literacy and internet use from the location profiles' sources) */
const VOICE_FIRST_REGIONS = new Set(['Kano', 'Kaduna', 'Borno', 'Northern', 'Upper East', 'Turkana', 'Benue', 'Cross River']);

/** Community roles visit homes, so the phone goes with them */
const COMMUNITY_ROLES = new Set(['chew', 'chips_agent', 'chp', 'cho']);

/** China and nearby: OpenAI, Anthropic and Google services are blocked; DeepSeek and Qwen are not */
const CHINA = /china|中国|prc|beijing|shanghai|shenzhen|guangzhou/i;

// ---------------------------------------------------------------------------
// Normalised facts
// ---------------------------------------------------------------------------

interface Facts {
  country: CountryCode | 'other';
  launch: boolean;
  countryName: string;
  inChina: boolean;
  region: string;
  role: string;
  community: boolean;
  smartphone: boolean;
  workPhone: boolean;
  iphoneOnly: boolean;
  ownLaptop: boolean;
  sharedComputerOnly: boolean;
  computer: boolean;
  basicOnly: boolean;
  os: SetupAnswers['computerOs'];
  internet: 'none' | 'patchy' | 'fourg' | 'wifi';
  online: boolean;
  data: 'tiny' | 'small' | 'medium' | 'large';
  power: 'reliable' | 'some_hours' | 'rarely';
  printer: Printer;
  aiApps: Set<string>;
  usesAI: boolean;
  canPay: boolean;
  caseload: SetupAnswers['caseload'];
  supported: boolean;
  comfort: 1 | 2 | 3 | 4;
  profile: LocationProfile | null;
}

function facts(a: SetupAnswers): Facts {
  const country: Facts['country'] = a.country === 'NG' || a.country === 'KE' || a.country === 'GH' ? a.country : 'other';
  const launch = country !== 'other';
  const devices = new Set(a.devices ?? []);
  const smartphone = ['android_phone', 'work_phone', 'iphone', 'tablet'].some((d) => devices.has(d as never));
  const ownLaptop = devices.has('laptop');
  const sharedComputer = devices.has('shared_computer');
  const internet = a.internet === 'none' || a.internet === 'fourg' || a.internet === 'wifi' ? a.internet : 'patchy';
  const region = a.region && a.region !== 'not_sure' ? a.region : '';
  const aiApps = new Set((a.aiApps ?? []).filter((x) => x !== 'none'));
  return {
    country,
    launch,
    countryName: launch ? COUNTRY_NAMES[country as CountryCode] : (a.countryOther?.trim() || 'your country'),
    inChina: country === 'other' && CHINA.test(a.countryOther ?? ''),
    region,
    role: a.role && a.role !== 'not_sure' ? a.role : 'other',
    community: COMMUNITY_ROLES.has(a.role ?? ''),
    smartphone,
    workPhone: devices.has('work_phone'),
    iphoneOnly: devices.has('iphone') && !devices.has('android_phone') && !devices.has('work_phone') && !devices.has('tablet'),
    ownLaptop,
    sharedComputerOnly: sharedComputer && !ownLaptop,
    computer: ownLaptop || sharedComputer,
    basicOnly: !smartphone && !ownLaptop && !sharedComputer,
    os: a.computerOs,
    internet,
    online: internet === 'fourg' || internet === 'wifi',
    data: a.dataBudget === 'tiny' || a.dataBudget === 'medium' || a.dataBudget === 'large' ? a.dataBudget : internet === 'none' ? 'tiny' : 'small',
    power: a.electricity === 'reliable' || a.electricity === 'rarely' ? a.electricity : 'some_hours',
    printer: a.printer === 'own' || a.printer === 'facility' || a.printer === 'lga_office' ? a.printer : 'none',
    aiApps,
    usesAI: aiApps.size > 0,
    canPay: a.aiPay === 'me' || a.aiPay === 'programme',
    caseload: a.caseload,
    supported: a.setupBy === 'supervisor' || a.setupBy === 'programme',
    comfort: typeof a.techComfort === 'number' ? a.techComfort : 2,
    profile: launch ? getLocationProfile(country as CountryCode, region) : null,
  };
}

const officeWord = (c: Facts['country']) => (c === 'NG' ? 'LGA office' : c === 'KE' ? 'sub-county office' : c === 'GH' ? 'district office' : 'district office');

// ---------------------------------------------------------------------------
// 1. Where Gaskin runs
// ---------------------------------------------------------------------------

function chooseRun(f: Facts, env: SetupEnvironment): SetupPlan['run'] {
  // R1. No smartphone and no computer: Gaskin lives on the facility computer (or the supervisor's phone);
  //     the worker gets printed lists and SMS on her basic phone.
  if (f.basicOnly) {
    return {
      where: 'facility_hub',
      label: 'On the computer at your facility, with printed lists for you',
      reason: 'You have a basic phone, so Gaskin runs on the facility or supervisor\'s computer. You carry printed visit lists and picture cards, and Gaskin sends SMS to mothers.',
    };
  }
  // R2. A facility role with her own laptop, or a supervisor or very large caseload: the laptop is the
  //     main screen (bigger lists, printing), and the phone can open the same backup later.
  const laptopFirst = f.ownLaptop && (!f.smartphone || (!f.community && (f.role === 'supervisor' || f.role === 'doctor' || f.role === 'midwife' || f.role === 'nurse') && f.power !== 'rarely') || f.caseload === 'over_150');
  if (laptopFirst) {
    // R2a. Offline, old Windows, or already opened from a stick: run from the USB stick, no install.
    const usb = !f.online || f.os === 'windows_old' || env.fromFile === true;
    return usb
      ? {
          where: 'laptop_usb',
          label: 'On your laptop, straight from a USB stick',
          reason: `${f.os === 'windows_old' ? 'Your laptop runs older Windows, ' : ''}${!f.online ? 'the internet comes and goes, ' : ''}so Gaskin runs from a USB stick in the browser with nothing to install, and saves your records on the stick.`.replace(/^./, (c) => c.toUpperCase()),
        }
      : {
          where: 'laptop_browser',
          label: 'On your laptop, in the browser',
          reason: 'You have a laptop and good internet, so Gaskin opens in Chrome or Edge like a website, works offline once loaded, and saves to a folder you choose.',
        };
  }
  // R3. A smartphone or tablet: install Gaskin as an app on the home screen; it goes on every home visit.
  if (f.smartphone) {
    return {
      where: 'phone_app',
      label: f.workPhone ? 'On your work phone, as an app' : 'On your phone, as an app',
      reason: f.workPhone
        ? 'Your work phone goes with you on home visits. Gaskin sits next to your programme app and works without internet.'
        : 'Your phone goes with you on home visits. Gaskin installs like an app and works without internet.',
    };
  }
  // R4. Only a shared facility computer.
  return {
    where: 'facility_hub',
    label: 'On the shared computer at your facility',
    reason: 'You can use a shared computer, so Gaskin keeps everyone\'s records there and prints your lists and picture cards.',
  };
}

// ---------------------------------------------------------------------------
// 2. Where records are kept
// ---------------------------------------------------------------------------

function chooseStorage(f: Facts, run: SetupPlan['run'], env: SetupEnvironment): SetupPlan['storage'] {
  // Rolling backups: more often when power is unreliable, because a flat battery mid-save is the commonest loss.
  const days = f.power === 'rarely' ? 1 : f.power === 'some_hours' ? 3 : 7;
  const folderOk = env.folderAccess !== false; // unknown counts as yes on a laptop: Chrome and Edge have it
  let mode: StorageChoice;
  let label: string;
  let reason: string;
  let locationLabel: string | undefined;
  if (run.where === 'laptop_usb') {
    mode = folderOk ? 'folder' : 'file';
    locationLabel = 'GASKIN folder on the USB stick';
    label = folderOk ? 'In a GASKIN folder on your USB stick' : 'In this browser, with a backup file saved to the USB stick';
    reason = folderOk
      ? 'Your records travel with the stick and open on any computer. Gaskin saves after every change and keeps the last 10 copies.'
      : 'This browser cannot write straight into folders, so Gaskin keeps records in the browser and downloads a backup file you move to the stick.';
  } else if (run.where === 'laptop_browser' || (run.where === 'facility_hub' && f.computer)) {
    mode = folderOk ? 'folder' : 'browser';
    locationLabel = run.where === 'facility_hub' ? 'Gaskin folder on the facility computer' : 'Gaskin folder in Documents';
    label = folderOk ? `In a folder you choose (${locationLabel})` : 'In this browser, with regular backup files';
    reason = folderOk
      ? 'A real file you can see, copy and back up. Gaskin keeps rolling copies so a mistake can be undone.'
      : 'Records stay in the browser on this computer; Gaskin downloads a backup file regularly.';
  } else {
    // Phones: browsers cannot write into phone folders, so records live in the app's own storage
    // and a backup file is saved to Downloads on a schedule.
    mode = 'browser';
    label = f.iphoneOnly ? 'On this iPhone, with a backup you save to Files' : 'On this phone, with a backup file in Downloads';
    reason = f.iphoneOnly
      ? 'iPhones can clear website data that is not used for a few weeks, so add Gaskin to the home screen and save a backup often.'
      : 'Records stay on the phone and work offline. A backup file is saved to Downloads so nothing is lost if the phone is lost or reset.';
  }
  return { mode, label, reason, backupEveryDays: mode === 'folder' ? 1 : days, locationLabel };
}

// ---------------------------------------------------------------------------
// 3. Languages
// ---------------------------------------------------------------------------

function chooseLanguages(a: SetupAnswers, f: Facts): SetupPlan['languages'] {
  const worker: WorkerLanguage = a.workerLanguage ?? 'en';
  const ui = (UI_LANGUAGES.has(worker) ? worker : 'en') as LanguageCode | 'fr';
  const notes: string[] = [];
  if (worker === 'zh') notes.push('Gaskin\'s screens are not in Chinese yet, so they show in English. Your AI can explain any plan in Chinese.');
  else if (worker === 'other') notes.push('Gaskin\'s screens show in English until a pack for your language exists. You can help write one.');

  // Mothers' languages: what she picked; if "Not sure", the three most spoken in her area.
  let mothers = (a.mothersLanguages ?? []).filter((l): l is LanguageCode => l !== 'not_sure');
  if (!mothers.length) {
    mothers = f.profile ? f.profile.languages.slice(0, 3) : ['en'];
    if (f.launch) notes.push(`We picked the most common languages in ${f.profile?.region || f.countryName}. Change them any time.`);
  }
  if (f.profile?.otherLanguages.length && f.launch) {
    notes.push(`Also spoken here, with no Gaskin pack yet: ${f.profile.otherLanguages.join(', ')}. Read messages aloud in these.`);
  }
  const install = [ui, ...mothers].filter((l, i, arr) => l !== 'en' && arr.indexOf(l) === i) as Array<LanguageCode | 'fr'>;
  if (install.length) notes.push('Language packs marked "draft" must be checked by a speaker before you send them to mothers.');
  return { ui, worker, mothers, install, notes };
}

// ---------------------------------------------------------------------------
// 4. AI
// ---------------------------------------------------------------------------

interface AIChoice {
  mode: SetupAIMode;
  label: string;
  reason: string;
  settings: AISettings;
  needsKey?: SetupPlan['ai']['needsKey'];
  assistant?: AssistantTarget;
  fallback: SetupAIMode;
}

function chooseAI(f: Facts, run: SetupPlan['run'], env: SetupEnvironment): AIChoice {
  const none = (reason: string): AIChoice => ({ mode: 'none', label: 'No AI for now', reason, settings: { mode: 'none' }, fallback: 'none' });

  // A1. Opened inside the Claude app: Claude is already here, nothing to set up.
  if (env.inClaude && f.internet !== 'none') {
    return {
      mode: 'claude_here',
      label: 'Claude, inside this app',
      reason: 'You opened Gaskin inside Claude, so it can write and translate messages with no set-up. Names and phone numbers are removed before anything is sent.',
      settings: { mode: 'claude_here' },
      fallback: 'none',
    };
  }
  // A2. No internet, or someone who finds phones hard: Gaskin's own templates are the quickest working start.
  if (f.internet === 'none') return none('There is no internet where you work, so Gaskin writes messages from its checked templates. Nothing to set up and no data used.');
  if (f.comfort === 1) return none('Gaskin writes messages from its checked templates, which is the simplest way to start. Your supervisor can add AI later.');

  // A3. Uses Claude and works on her own laptop: connect Claude Desktop to Gaskin (one-click extension).
  if (f.aiApps.has('claude') && f.ownLaptop && run.where !== 'phone_app' && f.comfort >= 3 && f.os !== 'linux' && f.os !== 'chromebook') {
    return {
      mode: 'connect_assistant',
      label: 'Connect your Claude app to Gaskin',
      reason: 'You already use Claude, so you can ask it things like "Who should I visit first today?" and it reads Gaskin directly, asking before any change.',
      settings: { mode: 'any_app' },
      assistant: 'claude_desktop',
      fallback: 'any_app',
    };
  }

  // A4. Can pay, comfortable with technology and good internet: use her own key with the service she knows.
  //     In China, OpenAI, Anthropic and Google are blocked, so DeepSeek (OpenAI-compatible) is the default.
  if (f.canPay && f.comfort >= 3 && f.online && f.data !== 'tiny') {
    let key: NonNullable<AIChoice['needsKey']>;
    if (f.inChina || f.aiApps.has('deepseek')) key = { kind: 'openai_compatible', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', service: 'DeepSeek', getKeyUrl: 'https://platform.deepseek.com/api_keys' };
    else if (f.aiApps.has('claude')) key = { kind: 'anthropic', model: 'claude-haiku-4-5', service: 'Claude API', getKeyUrl: 'https://console.anthropic.com/settings/keys' };
    else if (f.aiApps.has('gemini')) key = { kind: 'gemini', model: 'gemini-2.0-flash', service: 'Google Gemini', getKeyUrl: 'https://aistudio.google.com/apikey' };
    else key = { kind: 'openai_compatible', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', service: 'OpenAI', getKeyUrl: 'https://platform.openai.com/api-keys' };
    return {
      mode: 'own_key',
      label: `Your own ${key.service} key`,
      reason: `You can pay for AI and have good internet, so Gaskin uses ${key.service} directly to write and translate messages. A message costs well under one US cent. Names are removed first.`,
      settings: { mode: 'own_key', ownKey: { kind: key.kind, baseUrl: key.baseUrl, model: key.model, apiKey: '' } },
      needsKey: key,
      fallback: 'any_app',
    };
  }

  // A5. Already uses a free AI app on her phone (Meta AI in WhatsApp, ChatGPT, Gemini): copy and paste.
  if (f.usesAI && (f.smartphone || f.computer)) {
    const app = f.aiApps.has('meta_ai') ? 'Meta AI in WhatsApp' : f.aiApps.has('chatgpt') ? 'ChatGPT' : f.aiApps.has('gemini') ? 'Gemini' : f.aiApps.has('claude') ? 'Claude' : 'your AI app';
    return {
      mode: 'any_app',
      label: `Copy and paste with ${app}`,
      reason: `You already use ${app}. Gaskin gives you a short request to copy, you paste the answer back, and Gaskin checks it. Free, and names are removed first.`,
      settings: { mode: 'any_app' },
      fallback: 'none',
    };
  }

  // A6. A laptop with a modern graphics chip, steady power and enough data for a one-time 1 GB download:
  //     a small model inside the browser, so nothing leaves the laptop.
  if (env.webgpu && f.ownLaptop && f.power === 'reliable' && (f.internet === 'wifi' || f.data === 'large')) {
    return {
      mode: 'on_device',
      label: 'A small AI on this laptop',
      reason: 'Your laptop can run a small AI itself after a one-time download of about 1 GB. Nothing leaves the laptop.',
      settings: { mode: 'on_device', onDevice: { kind: 'in_browser', model: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', deidentify: true } },
      fallback: 'none',
    };
  }

  // A7. Otherwise: templates. Everything works; AI can be added in Settings.
  return none('Gaskin writes messages from its checked templates in English and Pidgin. You can add AI later in Settings.');
}

// ---------------------------------------------------------------------------
// 5. How messages reach mothers
// ---------------------------------------------------------------------------

function chooseChannels(f: Facts, a: SetupAnswers): SetupPlan['channels'] {
  const out: SetupPlan['channels'] = [];
  const region = f.profile?.region ?? '';
  const waFirst = WHATSAPP_FIRST_REGIONS.has(region) || (f.country === 'other' && f.online);
  const voiceFirst = VOICE_FIRST_REGIONS.has(region) || (a.mothersLanguages ?? []).some((l) => l === 'ff' || l === 'ar' || l === 'dag');

  if (waFirst) {
    out.push({ channel: 'whatsapp', primary: true, reason: f.country === 'other' ? 'Good internet: send messages and picture cards on WhatsApp, or copy them into the app mothers use.' : `Most mothers in ${region} have smartphones and WhatsApp, which carries pictures and voice notes.` });
    out.push({ channel: 'sms', primary: false, reason: 'For mothers with basic phones. Works on every phone.' });
  } else {
    out.push({ channel: 'sms', primary: true, reason: `Works on every phone, with no data. Most mothers ${region ? `in ${region} ` : ''}have basic phones.` });
    out.push({ channel: 'whatsapp', primary: false, reason: 'For mothers who have WhatsApp: it carries pictures and voice notes.' });
  }
  if (voiceFirst) out.push({ channel: 'voice', primary: false, reason: 'Many mothers here do not read. Call her, or record a voice note in her language.' });
  if (f.printer !== 'none') out.push({ channel: 'print', primary: false, reason: 'Picture cards for mothers with no phone, or who share one.' });
  return out;
}

function choosePrinting(f: Facts): SetupPlan['printing'] {
  const office = officeWord(f.country);
  switch (f.printer) {
    case 'own':
      return { where: 'own', routine: 'Print a picture card for each mother when her plan changes, and your visit list every Monday morning.' };
    case 'facility':
      return { where: 'facility', routine: 'On clinic days, print the week\'s visit list and new picture cards at the facility. Keep a few spare danger-sign cards in your bag.' };
    case 'lga_office':
      return { where: 'lga_office', routine: `Once a month at the ${office}, print a stack of danger-sign and food cards and the month's visit list. Show other cards on your screen.` };
    default:
      return { where: 'none', routine: 'No printing needed. Show picture cards on your screen during visits, and send them by SMS or WhatsApp.' };
  }
}

function chooseSync(f: Facts, run: SetupPlan['run'], storage: SetupPlan['storage']): SetupPlan['sync'] {
  if (f.country === 'KE' && f.workPhone) {
    return { method: 'echis_alongside', routine: 'Keep recording visits in eCHIS as you do now. Use Gaskin to plan visits and write messages. Gaskin saves a backup file every week.' };
  }
  if (run.where === 'laptop_usb') {
    return { method: 'usb_copy', routine: 'Gaskin saves to the stick after every change and keeps the last 10 copies. Once a week, copy the GASKIN folder to the facility computer as a spare.' };
  }
  if (run.where === 'facility_hub') {
    return { method: 'facility_hub', routine: 'The facility computer holds all records. On clinic day, give your notes to the person entering them, and take home your printed list.' };
  }
  const every = storage.backupEveryDays === 1 ? 'every day' : `every ${storage.backupEveryDays} days`;
  return { method: 'device_only', routine: `Everything stays on this device. Gaskin saves a backup file ${every}; copy it to a computer or give it to your supervisor once a month.` };
}

// ---------------------------------------------------------------------------
// 6. First ten minutes
// ---------------------------------------------------------------------------

function firstSteps(f: Facts, plan: Omit<SetupPlan, 'firstTenMinutes' | 'notes'>): string[] {
  const s: string[] = [];
  s.push('The mothers you see first are made-up people for practice. Nothing you do to them is real.');
  if (plan.run.where === 'phone_app') s.push(plan.storage.label.includes('iPhone') ? 'Tap Share, then "Add to Home Screen", so Gaskin opens like an app.' : 'Tap "Install" or "Add to Home screen" when your phone asks, so Gaskin opens like an app.');
  if (plan.storage.mode === 'folder') s.push(plan.run.where === 'laptop_usb' ? 'When asked, choose the GASKIN folder on your USB stick and press "Allow".' : 'When asked, choose a folder for your records and press "Allow".');
  if (plan.languages.install.length) s.push('Wait for the language packs to finish. Then check one message in each language.');
  if (f.profile && f.profile.origin === 'curated') {
    s.push(`Open Settings and check the hospitals listed for ${f.profile.region}. Add the one you send mothers to most.`);
  }
  s.push('Open Today. The first mother on the list is the one to see first.');
  s.push('Open her plan. Read the red alerts first, then the foods and medicines.');
  switch (plan.ai.mode) {
    case 'any_app':
      s.push('Press "Write message". Copy the request into your AI app, then paste its answer back. Gaskin checks it.');
      break;
    case 'own_key':
      s.push(`Paste your ${plan.ai.needsKey?.service ?? 'AI'} key when asked. Then press "Write message" to try it.`);
      break;
    case 'connect_assistant':
      s.push('Open the Gaskin file in Claude to connect it. Then ask Claude "Who should I visit first today?".');
      break;
    case 'claude_here':
      s.push('Press "Write message" and allow Claude when asked.');
      break;
    case 'on_device':
      s.push('Start the AI download on Wi-Fi. It happens once; you can keep working while it runs.');
      break;
    default:
      s.push('Press "Write message" to see a message in her language. No AI is needed.');
  }
  if (plan.printing.where !== 'none') s.push('Print one picture card to test the printer.');
  else s.push('Open one picture card and show it on your screen.');
  s.push(plan.storage.mode === 'folder' ? 'Check the bottom of the screen says "Saved". That means your records are safe.' : 'Make your first backup now in Settings, under "Your data".');
  return s.slice(0, 10);
}

function extraNotes(f: Facts, plan: Omit<SetupPlan, 'firstTenMinutes' | 'notes'>): string[] {
  const n: string[] = [];
  if (f.power === 'rarely') n.push('Power is scarce: Gaskin works offline and uses little battery. Charge from solar or a power bank, and back up every day.');
  if (f.data === 'tiny' && f.internet !== 'none') n.push('Data is tight: Gaskin uses no data except for AI and WhatsApp. SMS costs the programme, not you.');
  if (f.profile?.malariaRisk === 'high') n.push(`${f.profile.region} has a lot of malaria, so plans include IPTp and bed nets.`);
  if (f.profile && !f.profile.malariaEndemic) n.push(`${f.profile.region} is outside Kenya's IPTp zones, so plans do not include IPTp. Test any fever.`);
  if (f.country === 'other') n.push(`Gaskin's medical rules follow WHO guidance and Nigerian, Kenyan and Ghanaian schedules. Check vaccines and medicines against ${f.countryName}'s own guidelines.`);
  if (f.inChina) n.push('WeChat is not built in. Copy messages into WeChat, or print them.');
  if (f.supported) n.push('Your supervisor can see this setup and change it with you.');
  if (plan.ai.mode !== 'none') n.push('AI never decides danger signs or medicines. Gaskin\'s checked rules do that, and Gaskin checks every AI answer.');
  return n;
}

// ---------------------------------------------------------------------------

export function recommendSetup(answers: SetupAnswers, env: SetupEnvironment = {}, now: string = new Date().toISOString()): SetupPlan {
  const f = facts(answers);
  const run = chooseRun(f, env);
  const storage = chooseStorage(f, run, env);
  const languages = chooseLanguages(answers, f);
  const ai = chooseAI(f, run, env);
  const channels = chooseChannels(f, answers);
  const printing = choosePrinting(f);
  const sync = chooseSync(f, run, storage);
  const base: Omit<SetupPlan, 'firstTenMinutes' | 'notes'> = {
    version: 1,
    createdAt: now,
    country: f.country,
    countryName: f.countryName,
    region: f.profile?.region ?? f.region,
    district: answers.district?.trim() || undefined,
    locationProfileId: f.profile?.id ?? null,
    run,
    storage,
    languages,
    ai: { ...ai, deidentify: true },
    channels,
    printing,
    sync,
  };
  return { ...base, firstTenMinutes: firstSteps(f, base), notes: extraNotes(f, base) };
}

/** Channels in plan order, primary first: handy for the messaging composer */
export function planChannels(plan: SetupPlan): Channel[] {
  return [...plan.channels].sort((a, b) => Number(b.primary) - Number(a.primary)).map((c) => c.channel);
}
