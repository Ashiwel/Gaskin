/**
 * Wizard text in the worker's language.
 *
 * Order of lookup: src/i18n pack ('onb.*' keys it already has, or 'setup.*' keys if a pack adds them),
 * then this local table, then English. The non-English lines below are drafts written for the
 * prototype and must be checked by native speakers before use with workers; answer labels
 * stay in English with pictograms until the packs carry them.
 */
import { t as packT, isPackCode, type UiKey } from '../i18n';
import type { WorkerLanguage } from './types';

export type SetupKey =
  | 'continue' | 'back' | 'skip' | 'not_sure' | 'step' | 'pick_all'
  | 'use_location' | 'location_consent' | 'location_found' | 'location_failed' | 'location_where' | 'district' | 'district_hint' | 'type_country'
  | 'summary_title' | 'summary_intro' | 'apply' | 'applying' | 'done' | 'change_answers'
  | 'card_run' | 'card_storage' | 'card_languages' | 'card_ai' | 'card_messages' | 'card_print' | 'card_sync' | 'card_first' | 'card_place'
  | 'key_label' | 'key_hint' | 'key_skip' | 'privacy_on'
  | 'step_lang' | 'step_ai' | 'step_place' | 'step_storage' | 'step_ready' | 'open_caseload'
  | `q.${string}`;

const EN: Record<string, string> = {
  continue: 'Continue',
  back: 'Back',
  skip: 'Skip',
  not_sure: 'Not sure',
  step: 'Question {n} of {total}',
  pick_all: 'Pick all that apply',
  use_location: 'Use my location',
  location_consent: 'Gaskin asks your phone where you are once, to find your area and nearby hospitals. It is kept only on this device.',
  location_found: 'You seem to be in {region}. Is that right?',
  location_failed: 'Could not find your location. Choose your area below.',
  location_where: 'Or choose your area',
  district: 'Your LGA, sub-county or district (optional)',
  district_hint: 'For example: Ikom, Kisumu West, Bongo',
  type_country: 'Type the country',
  summary_title: 'Here is your setup',
  summary_intro: 'Gaskin chose the quickest working setup for you. Press the button and it does everything.',
  apply: 'Set it up',
  applying: 'Setting up…',
  done: 'All done',
  change_answers: 'Change my answers',
  card_run: 'Where Gaskin runs',
  card_storage: 'Where your records are kept',
  card_languages: 'Languages',
  card_ai: 'AI helper',
  card_messages: 'How messages reach mothers',
  card_print: 'Printing',
  card_sync: 'Keeping records safe',
  card_first: 'Your first 10 minutes',
  card_place: 'Your area',
  key_label: 'Paste your {service} key (optional)',
  key_hint: 'Leave it empty to use copy and paste for now. The key stays on this device.',
  key_skip: 'No key: copy and paste for now',
  privacy_on: 'Names, phone numbers, places and dates are removed before anything goes to AI.',
  step_lang: 'Getting languages ready',
  step_ai: 'Setting up the AI helper',
  step_place: 'Loading foods, hospitals and malaria advice for your area',
  step_storage: 'Choosing where to keep your records',
  step_ready: 'Ready',
  open_caseload: 'Open my mothers',
  'q.workerLanguage': 'Which language do you want Gaskin in?',
};

/** Drafts: chrome and question titles. Not reviewed. */
const LOCAL: Partial<Record<WorkerLanguage, Record<string, string>>> = {
  pcm: {
    continue: 'Continue', back: 'Go back', skip: 'Skip am', not_sure: 'I no sure', step: 'Question {n} for {total}', pick_all: 'Pick all wey dey true',
    use_location: 'Use where I dey', location_consent: 'Gaskin go ask your phone where you dey one time, to find your area and hospital wey near. E go stay only for this phone.',
    location_found: 'E be like say you dey {region}. Na so?', location_failed: 'We no fit find where you dey. Choose your area for down.',
    summary_title: 'Na your setup be this', summary_intro: 'Gaskin don choose the quickest way wey go work for you. Press the button, e go do everything.',
    apply: 'Set am up', applying: 'E dey set up…', done: 'E don finish', open_caseload: 'Open my mothers', change_answers: 'Change my answers',
    'q.country': 'Which country you dey work?', 'q.location': 'Where you dey work?', 'q.role': 'Wetin be your work?', 'q.mothersLanguages': 'Which language the mothers wey you dey see dey speak?',
    'q.devices': 'Wetin you fit use for work?', 'q.computerOs': 'Which kind computer e be?', 'q.internet': 'How network be for where you dey work?', 'q.dataBudget': 'How much data you dey buy every month?',
    'q.electricity': 'How often you get light to charge?', 'q.printer': 'You fit print?', 'q.aiApps': 'You don use any AI app before?', 'q.aiPay': 'You or your programme fit pay for AI?',
    'q.caseload': 'How many mothers and pikin you dey take care of?', 'q.setupBy': 'Who tell you make you use Gaskin?', 'q.techComfort': 'How easy phone and computer be for you?',
  },
  ha: {
    continue: 'Ci gaba', back: 'Koma baya', skip: 'Tsallake', not_sure: 'Ban tabbata ba', step: 'Tambaya {n} cikin {total}',
    use_location: 'Yi amfani da wurin da nake', location_found: 'Kamar kina {region}. Haka ne?', location_failed: 'Ba a sami wurinki ba. Zaɓi yankinki a ƙasa.',
    summary_title: 'Ga tsarin da aka shirya miki', apply: 'Shirya shi', applying: 'Ana shiryawa…', done: 'An gama', open_caseload: 'Buɗe iyayena mata',
    'q.country': 'A wace ƙasa kike aiki?', 'q.location': 'A ina kike aiki?', 'q.role': 'Mene ne aikinki?', 'q.mothersLanguages': 'Wane harshe iyaye mata da kike gani suke magana?',
    'q.devices': 'Me za ki iya amfani da shi wajen aiki?', 'q.internet': 'Yaya intanet yake a wurin aikinki?', 'q.electricity': 'Sau nawa kike samun wutar caji?', 'q.printer': 'Za ki iya bugawa?',
    'q.aiApps': 'Kin taɓa amfani da wata manhajar AI?', 'q.caseload': 'Iyaye mata da jarirai nawa kike kula da su?', 'q.techComfort': 'Yaya sauƙin waya da kwamfuta yake a gare ki?',
  },
  yo: {
    continue: 'Tẹ̀síwájú', back: 'Padà sẹ́yìn', skip: 'Fò ó', not_sure: 'Mi ò dá mi lójú', step: 'Ìbéèrè {n} nínú {total}',
    use_location: 'Lo ibi tí mo wà', summary_title: 'Ètò rẹ nìyí', apply: 'Ṣètò rẹ̀', applying: 'Ó ń ṣètò…', done: 'Ó ti parí', open_caseload: 'Ṣí àwọn ìyá mi',
    'q.country': 'Orílẹ̀-èdè wo lo ti ń ṣiṣẹ́?', 'q.location': 'Níbo lo ti ń ṣiṣẹ́?', 'q.role': 'Kí ni iṣẹ́ rẹ?', 'q.mothersLanguages': 'Èdè wo ni àwọn ìyá tí o ń rí ń sọ?',
    'q.devices': 'Kí lo lè lò fún iṣẹ́?', 'q.internet': 'Báwo ni íntánẹ́ẹ̀tì ṣe rí níbi iṣẹ́ rẹ?', 'q.printer': 'Ṣé o lè tẹ̀wé jáde?',
  },
  ig: {
    continue: 'Gaa n\'ihu', back: 'Laghachi azụ', skip: 'Wụfee', not_sure: 'Amaghị m nke ọma', step: 'Ajụjụ {n} n\'ime {total}',
    use_location: 'Jiri ebe m nọ', summary_title: 'Nke a bụ ndozi gị', apply: 'Dozie ya', applying: 'Ọ na-edozi…', done: 'O mechaala', open_caseload: 'Mepee ndị nne m',
    'q.country': 'Mba ole ka ị na-arụ ọrụ?', 'q.location': 'Ebee ka ị na-arụ ọrụ?', 'q.role': 'Gịnị bụ ọrụ gị?', 'q.mothersLanguages': 'Asụsụ ole ka ndị nne ị na-ahụ na-asụ?',
    'q.devices': 'Gịnị ka ị nwere ike iji rụọ ọrụ?', 'q.internet': 'Kedu ka ịntanetị dị n\'ebe ị na-arụ ọrụ?',
  },
  sw: {
    continue: 'Endelea', back: 'Rudi', skip: 'Ruka', not_sure: 'Sina uhakika', step: 'Swali {n} kati ya {total}', pick_all: 'Chagua vyote vinavyohusika',
    use_location: 'Tumia mahali nilipo', location_consent: 'Gaskin itauliza simu yako mahali ulipo mara moja, ili kupata eneo lako na hospitali zilizo karibu. Inahifadhiwa kwenye kifaa hiki tu.',
    location_found: 'Inaonekana uko {region}. Ni sawa?', location_failed: 'Hatukuweza kupata mahali ulipo. Chagua eneo lako hapa chini.', location_where: 'Au chagua eneo lako',
    district: 'Kaunti ndogo au wadi yako (si lazima)', summary_title: 'Huu ndio mpangilio wako', summary_intro: 'Gaskin imekuchagulia njia ya haraka zaidi inayofanya kazi. Bonyeza kitufe na itafanya kila kitu.',
    apply: 'Iweke tayari', applying: 'Inaweka…', done: 'Imekamilika', open_caseload: 'Fungua akina mama wangu', change_answers: 'Badilisha majibu yangu',
    card_run: 'Gaskin inafanya kazi wapi', card_storage: 'Kumbukumbu zako zinahifadhiwa wapi', card_languages: 'Lugha', card_ai: 'Msaidizi wa AI', card_messages: 'Ujumbe unawafikiaje akina mama', card_print: 'Kuchapisha', card_sync: 'Kulinda kumbukumbu', card_first: 'Dakika 10 zako za kwanza', card_place: 'Eneo lako',
    privacy_on: 'Majina, nambari za simu, mahali na tarehe huondolewa kabla ya kitu chochote kwenda kwa AI.',
    'q.country': 'Unafanya kazi nchi gani?', 'q.location': 'Unafanya kazi wapi?', 'q.role': 'Kazi yako ni ipi?', 'q.mothersLanguages': 'Akina mama unaowaona wanazungumza lugha gani?',
    'q.devices': 'Unaweza kutumia nini kazini?', 'q.computerOs': 'Ni kompyuta ya aina gani?', 'q.internet': 'Intaneti iko vipi unapofanya kazi?', 'q.dataBudget': 'Unanunua data kiasi gani kila mwezi?',
    'q.electricity': 'Unapata umeme wa kuchaji mara ngapi?', 'q.printer': 'Unaweza kuchapisha?', 'q.aiApps': 'Umewahi kutumia programu yoyote ya AI?', 'q.aiPay': 'Wewe au mpango wako mnaweza kulipia AI?',
    'q.caseload': 'Unawahudumia akina mama na watoto wangapi?', 'q.setupBy': 'Nani alikuomba utumie Gaskin?', 'q.techComfort': 'Simu na kompyuta ni rahisi kiasi gani kwako?',
  },
  tw: {
    continue: 'Kɔ so', back: 'San w\'akyi', skip: 'Twa mu', not_sure: 'Menim pɛpɛɛpɛ', step: 'Asɛmmisa {n} wɔ {total} mu',
    summary_title: 'Wo nhyehyɛe ni', apply: 'Hyehyɛ', applying: 'Ɛrehyehyɛ…', done: 'Awie', open_caseload: 'Bue me maamefo',
    'q.country': 'Ɔman bɛn mu na woyɛ adwuma?', 'q.location': 'Ɛhe na woyɛ adwuma?', 'q.role': 'Dɛn ne w\'adwuma?', 'q.mothersLanguages': 'Kasa bɛn na maamefo a wuhu wɔn no ka?',
  },
  fr: {
    continue: 'Continuer', back: 'Retour', skip: 'Passer', not_sure: 'Je ne sais pas', step: 'Question {n} sur {total}', pick_all: 'Choisissez tout ce qui s\'applique',
    use_location: 'Utiliser ma position', location_consent: 'Gaskin demande une seule fois votre position pour trouver votre zone et les hôpitaux proches. Elle reste sur cet appareil.',
    location_found: 'Vous semblez être à {region}. Est-ce exact ?', location_failed: 'Position introuvable. Choisissez votre zone ci-dessous.', location_where: 'Ou choisissez votre zone',
    district: 'Votre district (facultatif)', type_country: 'Écrivez le pays',
    summary_title: 'Voici votre configuration', summary_intro: 'Gaskin a choisi la configuration la plus rapide pour vous. Appuyez sur le bouton et tout se fait.',
    apply: 'Tout configurer', applying: 'Configuration…', done: 'Terminé', open_caseload: 'Ouvrir mes mères', change_answers: 'Modifier mes réponses',
    card_run: 'Où Gaskin fonctionne', card_storage: 'Où sont gardés vos dossiers', card_languages: 'Langues', card_ai: 'Assistant IA', card_messages: 'Messages aux mères', card_print: 'Impression', card_sync: 'Sauvegarde', card_first: 'Vos 10 premières minutes', card_place: 'Votre zone',
    key_label: 'Collez votre clé {service} (facultatif)', key_hint: 'Laissez vide pour utiliser le copier-coller. La clé reste sur cet appareil.',
    privacy_on: 'Les noms, numéros, lieux et dates sont retirés avant tout envoi à l\'IA.',
    'q.country': 'Dans quel pays travaillez-vous ?', 'q.location': 'Où travaillez-vous ?', 'q.role': 'Quel est votre métier ?', 'q.mothersLanguages': 'Quelles langues parlent les mères que vous suivez ?',
    'q.devices': 'Qu\'utilisez-vous pour travailler ?', 'q.computerOs': 'Quel type d\'ordinateur ?', 'q.internet': 'Comment est Internet là où vous travaillez ?', 'q.dataBudget': 'Combien de données achetez-vous par mois ?',
    'q.electricity': 'Avez-vous souvent de l\'électricité pour recharger ?', 'q.printer': 'Pouvez-vous imprimer ?', 'q.aiApps': 'Avez-vous déjà utilisé une application d\'IA ?', 'q.aiPay': 'Vous ou votre programme pouvez-vous payer l\'IA ?',
    'q.caseload': 'Combien de mères et de bébés suivez-vous ?', 'q.setupBy': 'Qui vous a demandé d\'utiliser Gaskin ?', 'q.techComfort': 'Les téléphones et ordinateurs sont-ils faciles pour vous ?',
  },
  zh: {
    continue: '继续', back: '返回', skip: '跳过', not_sure: '不确定', step: '第 {n} 题，共 {total} 题', pick_all: '可多选',
    use_location: '使用我的位置', location_consent: 'Gaskin 只会询问一次您的位置，用于查找您所在地区和附近医院。位置只保存在本设备上。',
    location_found: '您似乎在 {region}。对吗？', location_failed: '无法获取位置。请在下方选择地区。', location_where: '或选择您的地区', type_country: '输入国家名称',
    district: '您所在的区县（可选）',
    summary_title: '这是为您准备的设置', summary_intro: 'Gaskin 为您选择了最快可用的设置。按下按钮即可全部完成。',
    apply: '一键设置', applying: '正在设置…', done: '完成', open_caseload: '打开我的孕产妇名单', change_answers: '修改我的回答',
    card_run: 'Gaskin 在哪里运行', card_storage: '记录保存在哪里', card_languages: '语言', card_ai: 'AI 助手', card_messages: '如何给母亲发消息', card_print: '打印', card_sync: '保护记录', card_first: '最初的 10 分钟', card_place: '您的地区',
    key_label: '粘贴您的 {service} 密钥（可选）', key_hint: '留空则先使用复制粘贴方式。密钥只保存在本设备上。',
    privacy_on: '发送给 AI 之前，会先删除姓名、电话号码、地点和日期。',
    'q.country': '您在哪个国家工作？', 'q.location': '您在哪里工作？', 'q.role': '您的工作是什么？', 'q.mothersLanguages': '您服务的母亲们说哪些语言？',
    'q.devices': '您工作时可以使用什么设备？', 'q.computerOs': '是哪种电脑？', 'q.internet': '您工作地点的网络如何？', 'q.dataBudget': '您每月购买多少流量？',
    'q.electricity': '您多久能有电充电？', 'q.printer': '您能打印吗？', 'q.aiApps': '您用过哪些 AI 应用？', 'q.aiPay': '您或您的项目可以为 AI 付费吗？',
    'q.caseload': '您照顾多少位母亲和婴儿？', 'q.setupBy': '是谁让您使用 Gaskin 的？', 'q.techComfort': '使用手机和电脑对您来说有多容易？',
  },
};

/** Keys the i18n packs already carry for the same idea */
const PACK_KEYS: Partial<Record<string, UiKey>> = { continue: 'onb.continue', skip: 'onb.skip' };

function fill(s: string, params?: Record<string, string | number>): string {
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m)) : s;
}

/**
 * Text for the wizard in the worker's language. `english` overrides the English source
 * (used for question titles, which live in questions.ts).
 */
export function st(key: SetupKey, lang: WorkerLanguage | undefined, params?: Record<string, string | number>, english?: string): string {
  const l = lang ?? 'en';
  if (l !== 'en') {
    const local = LOCAL[l]?.[key];
    if (local) return fill(local, params);
    const pk = PACK_KEYS[key];
    if (pk && isPackCode(l)) {
      try {
        const out = packT(pk, l);
        if (out && out !== pk) return fill(out, params);
      } catch {
        /* pack missing: fall through */
      }
    }
  }
  return fill(english ?? EN[key] ?? key, params);
}

/** BCP 47 tag for the lang attribute */
export function langTag(lang: WorkerLanguage | undefined): string {
  if (!lang || lang === 'other') return 'en';
  if (lang === 'zh') return 'zh-Hans';
  return lang;
}
