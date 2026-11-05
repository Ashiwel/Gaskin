/**
 * Medicine lexicon used by the guardrails (to spot medicine names the AI
 * must not introduce) and by the template extractor (to pull medications
 * out of doctors' free text). Generic names first, then common brand and
 * local names seen in Nigerian, Kenyan and Ghanaian practice.
 *
 * `names` are matched case-insensitively on word boundaries; hyphens,
 * slashes and spaces between parts are interchangeable and "sulphate"
 * also matches "sulfate". `abbrev` are matched case-sensitively, because
 * short upper-case abbreviations (SP, AL) collide with ordinary words.
 */

export interface MedicineEntry {
  /** Canonical generic name shown to the worker */
  generic: string;
  /** Lower-case generic synonyms and brand names */
  names: string[];
  /** Case-sensitive abbreviations */
  abbrev?: string[];
}

export const MEDICINE_LEXICON: MedicineEntry[] = [
  // Hypertension in pregnancy
  { generic: 'methyldopa', names: ['methyldopa', 'methyl dopa', 'aldomet', 'dopamet'] },
  { generic: 'nifedipine', names: ['nifedipine', 'adalat', 'adalat retard', 'nifecard', 'nifedi-denk'] },
  { generic: 'labetalol', names: ['labetalol', 'trandate'] },
  { generic: 'hydralazine', names: ['hydralazine', 'apresoline'] },
  { generic: 'amlodipine', names: ['amlodipine', 'norvasc', 'amlovar'] },
  { generic: 'lisinopril', names: ['lisinopril', 'zestril'] },
  { generic: 'losartan', names: ['losartan', 'cozaar'] },
  { generic: 'magnesium sulphate', names: ['magnesium sulphate', 'mag sulph', 'mag sulphate'], abbrev: ['MgSO4', 'MGSO4'] },
  { generic: 'calcium gluconate', names: ['calcium gluconate'] },
  { generic: 'calcium supplement', names: ['calcium carbonate', 'calcium tablet', 'calcium tablets', 'calcium supplement', 'calcium supplements'] },
  { generic: 'aspirin', names: ['aspirin', 'low-dose aspirin', 'cardiprin', 'ecotrin', 'disprin'] },

  // Anaemia
  { generic: 'ferrous sulphate', names: ['ferrous sulphate', 'iron sulphate'], abbrev: ['FeSO4', 'FESO4'] },
  { generic: 'ferrous fumarate', names: ['ferrous fumarate'] },
  { generic: 'ferrous gluconate', names: ['ferrous gluconate'] },
  { generic: 'iron supplement', names: ['iron tablet', 'iron tablets', 'iron and folic acid', 'iron-folate', 'iron folate', 'haematinic', 'haematinics', 'hematinic', 'chemiron', 'fesolate', 'ranferon', 'feroglobin', 'pregnacare', 'astyfer', 'iron sucrose', 'venofer'] },
  { generic: 'folic acid', names: ['folic acid', 'folate', 'folvite'] },
  { generic: 'vitamin B12', names: ['vitamin b12', 'cyanocobalamin', 'hydroxocobalamin'] },
  { generic: 'multivitamin', names: ['multivitamin', 'multivitamins', 'pregnavit', 'prenatal vitamin', 'prenatal vitamins'] },

  // Malaria
  { generic: 'artemether-lumefantrine', names: ['artemether-lumefantrine', 'artemether lumefantrine', 'coartem', 'lonart', 'lumartem', 'amatem', 'artefan', 'lumether', 'lufanther'] },
  { generic: 'artesunate', names: ['artesunate', 'larinate'] },
  { generic: 'artesunate-amodiaquine', names: ['artesunate-amodiaquine', 'amodiaquine', 'camosunate', 'coarsucam'], abbrev: ['ASAQ'] },
  { generic: 'dihydroartemisinin-piperaquine', names: ['dihydroartemisinin', 'piperaquine', 'p-alaxin', 'duo-cotecxin'] },
  { generic: 'sulfadoxine-pyrimethamine', names: ['sulfadoxine-pyrimethamine', 'sulphadoxine-pyrimethamine', 'sulfadoxine', 'sulphadoxine', 'fansidar', 'maloxine', 'amalar'], abbrev: ['SP', 'IPTp-SP'] },
  { generic: 'quinine', names: ['quinine'] },
  { generic: 'chloroquine', names: ['chloroquine'] },
  { generic: 'proguanil', names: ['proguanil', 'paludrine'] },

  // Diabetes
  { generic: 'metformin', names: ['metformin', 'glucophage'] },
  { generic: 'insulin', names: ['insulin', 'mixtard', 'actrapid', 'insulatard', 'humulin', 'lantus', 'novorapid'] },
  { generic: 'glibenclamide', names: ['glibenclamide', 'daonil'] },

  // Antibiotics
  { generic: 'amoxicillin', names: ['amoxicillin', 'amoxycillin', 'amoxil'] },
  { generic: 'amoxicillin-clavulanate', names: ['amoxicillin-clavulanate', 'co-amoxiclav', 'augmentin', 'amoksiklav'] },
  { generic: 'ampicillin', names: ['ampicillin', 'ampiclox'] },
  { generic: 'ceftriaxone', names: ['ceftriaxone', 'rocephin'] },
  { generic: 'cefuroxime', names: ['cefuroxime', 'zinnat'] },
  { generic: 'cefalexin', names: ['cefalexin', 'cephalexin', 'keflex'] },
  { generic: 'metronidazole', names: ['metronidazole', 'flagyl'] },
  { generic: 'nitrofurantoin', names: ['nitrofurantoin', 'macrodantin'] },
  { generic: 'ciprofloxacin', names: ['ciprofloxacin', 'ciprotab', 'cipro'] },
  { generic: 'gentamicin', names: ['gentamicin', 'gentamycin'] },
  { generic: 'co-trimoxazole', names: ['co-trimoxazole', 'cotrimoxazole', 'septrin', 'bactrim'] },
  { generic: 'azithromycin', names: ['azithromycin', 'zithromax'] },
  { generic: 'erythromycin', names: ['erythromycin'] },
  { generic: 'clindamycin', names: ['clindamycin'] },
  { generic: 'benzathine penicillin', names: ['benzathine penicillin', 'penicillin', 'penadur'] },
  { generic: 'flucloxacillin', names: ['flucloxacillin', 'cloxacillin'] },

  // Birth and postpartum
  { generic: 'oxytocin', names: ['oxytocin', 'pitocin', 'syntocinon'] },
  { generic: 'misoprostol', names: ['misoprostol', 'cytotec'] },
  { generic: 'ergometrine', names: ['ergometrine', 'syntometrine'] },
  { generic: 'tranexamic acid', names: ['tranexamic acid', 'cyklokapron'] },
  { generic: 'carbetocin', names: ['carbetocin'] },
  { generic: 'dexamethasone', names: ['dexamethasone'] },
  { generic: 'betamethasone', names: ['betamethasone'] },
  { generic: 'anti-D immunoglobulin', names: ['anti-d', 'rhogam'] },

  // Pain, fever, gut
  { generic: 'paracetamol', names: ['paracetamol', 'acetaminophen', 'panadol', 'tylenol', 'emzor paracetamol', 'pcm tablets'] },
  { generic: 'ibuprofen', names: ['ibuprofen', 'brufen', 'nurofen'] },
  { generic: 'diclofenac', names: ['diclofenac', 'voltaren', 'cataflam'] },
  { generic: 'tramadol', names: ['tramadol'] },
  { generic: 'pentazocine', names: ['pentazocine', 'fortwin'] },
  { generic: 'codeine', names: ['codeine'] },
  { generic: 'metoclopramide', names: ['metoclopramide', 'plasil'] },
  { generic: 'promethazine', names: ['promethazine', 'phenergan'] },
  { generic: 'hyoscine butylbromide', names: ['hyoscine', 'buscopan'] },
  { generic: 'antacid', names: ['antacid', 'gestid', 'gelusil', 'mist mag', 'magnesium trisilicate'] },
  { generic: 'omeprazole', names: ['omeprazole'] },
  { generic: 'ranitidine', names: ['ranitidine', 'zantac'] },
  { generic: 'albendazole', names: ['albendazole', 'zentel'] },
  { generic: 'mebendazole', names: ['mebendazole', 'vermox'] },
  { generic: 'oral rehydration salts', names: ['oral rehydration salts', 'oral rehydration solution'], abbrev: ['ORS'] },
  { generic: 'zinc', names: ['zinc tablet', 'zinc tablets', 'zinc sulphate', 'zinc supplement'] },

  // HIV
  { generic: 'tenofovir-lamivudine-dolutegravir', names: ['tenofovir', 'lamivudine', 'dolutegravir'], abbrev: ['TLD', 'TDF', '3TC', 'DTG'] },
  { generic: 'efavirenz', names: ['efavirenz'] },
  { generic: 'nevirapine', names: ['nevirapine'], abbrev: ['NVP'] },
  { generic: 'zidovudine', names: ['zidovudine'], abbrev: ['AZT'] },

  // Other chronic conditions
  { generic: 'hydroxyurea', names: ['hydroxyurea', 'hydroxycarbamide'] },
  { generic: 'levothyroxine', names: ['levothyroxine', 'eltroxin'] },
  { generic: 'salbutamol', names: ['salbutamol', 'ventolin'] },
  { generic: 'carbamazepine', names: ['carbamazepine', 'tegretol'] },
  { generic: 'sodium valproate', names: ['valproate', 'epilim'] },
  { generic: 'phenobarbitone', names: ['phenobarbitone', 'phenobarbital', 'luminal'] },
  { generic: 'diazepam', names: ['diazepam', 'valium'] },
  { generic: 'sertraline', names: ['sertraline'] },
  { generic: 'fluoxetine', names: ['fluoxetine', 'prozac'] },
  { generic: 'pyridoxine', names: ['pyridoxine', 'vitamin b6'] },
  { generic: 'vitamin K', names: ['vitamin k', 'phytomenadione', 'konakion'] },
  { generic: 'chlorhexidine', names: ['chlorhexidine'] },

  // Family planning
  { generic: 'levonorgestrel', names: ['levonorgestrel', 'postinor', 'jadelle'] },
  { generic: 'medroxyprogesterone', names: ['medroxyprogesterone', 'depo-provera', 'sayana press'] },
  { generic: 'etonogestrel implant', names: ['etonogestrel', 'implanon', 'nexplanon'] },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regex source for one lexicon name: flexible separators, sulphate/sulfate */
export function nameToRegexSource(name: string): string {
  return name
    .split(/[\s\-/]+/)
    .map((part) => escapeRe(part).replace(/sulphate/g, 'sul(?:ph|f)ate'))
    .join('[\\s\\-/]*');
}

interface CompiledEntry {
  entry: MedicineEntry;
  re: RegExp;
  abbrevRe?: RegExp;
}

let compiled: CompiledEntry[] | null = null;

function compile(): CompiledEntry[] {
  if (compiled) return compiled;
  compiled = MEDICINE_LEXICON.map((entry) => {
    // Longest names first so "adalat retard" wins over "adalat"
    const names = [...entry.names].sort((a, b) => b.length - a.length);
    const re = new RegExp(`(?<![\\w-])(?:${names.map(nameToRegexSource).join('|')})(?![\\w])`, 'gi');
    const abbrevRe = entry.abbrev?.length
      ? new RegExp(`(?<![\\w-])(?:${entry.abbrev.map(escapeRe).join('|')})(?![\\w])`, 'g')
      : undefined;
    return { entry, re, abbrevRe };
  });
  return compiled;
}

export interface MedicineMention {
  generic: string;
  /** The text as written */
  matched: string;
  index: number;
}

/** Find every lexicon medicine mentioned in a text */
export function findMedicines(text: string): MedicineMention[] {
  const out: MedicineMention[] = [];
  for (const { entry, re, abbrevRe } of compile()) {
    for (const r of [re, abbrevRe]) {
      if (!r) continue;
      r.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = r.exec(text))) {
        out.push({ generic: entry.generic, matched: m[0], index: m.index });
      }
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Generic names of all lexicon medicines mentioned in a text */
export function medicineGenericsIn(text: string): Set<string> {
  return new Set(findMedicines(text).map((m) => m.generic));
}
