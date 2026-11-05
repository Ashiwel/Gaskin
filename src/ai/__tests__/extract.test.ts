import { describe, expect, it } from 'vitest';
import { templateProvider } from '../providers/template';
import type { ExtractedFinding } from '../../types';

const get = (fs: ExtractedFinding[], field: string) => fs.filter((f) => f.field === field).map((f) => f.value);

describe('template extraction from doctor reports', () => {
  it('reads a Nigerian discharge summary with severe pre-eclampsia', async () => {
    const text = `DISCHARGE SUMMARY - Dept of Obstetrics & Gynaecology
Name: Mrs Adaeze Okafor   Hosp No: UNTH/2026/04512   Age: 24yrs
G2P1+0 at 34/40. Admitted 02/11/2026 with severe headache. B/P: 160/110mmHg, urinalysis protein ++.
Diagnosis: Severe pre-eclampsia. Loaded with MgSO4 4g IV stat then 1g/hr for 24 hrs.
Discharged on tab methyldopa 500mg tds and nifedipine 20mg bd. BP at discharge 150/100.
Plan: Continue antihypertensives, daily BP checks at PHC. TCA in 1/52 at ANC clinic.
Signed: Dr C. Eze (Registrar)`;
    const f = await templateProvider.extractFindings({ text });
    expect(get(f, 'systolic')).toEqual(['150']);
    expect(get(f, 'diastolic')).toEqual(['100']);
    expect(get(f, 'gestational_weeks')).toEqual(['34']);
    expect(get(f, 'urine_protein')).toEqual(['++']);
    expect(get(f, 'diagnosis')).toContain('severe pre-eclampsia');
    const meds = get(f, 'medication').join(' | ');
    expect(meds).toMatch(/methyldopa 500mg tds/);
    expect(meds).toMatch(/nifedipine 20mg bd/);
    expect(meds).toMatch(/magnesium sulphate/);
    expect(get(f, 'follow_up')[0]).toMatch(/1 week/);
    expect(get(f, 'plan')[0]).toMatch(/Continue antihypertensives/);
  });

  it('converts PCV to Hb and says so (anaemia and malaria report)', async () => {
    const text = `Referral note, General Hospital Ikorodu. 28yr old G3P2 at 26 weeks gestation.
Complains of fever and weakness x 3/7. Temp 38.6°C. Wt 62kg. MP: positive (RDT positive).
PCV 24%. Impression: Malaria in pregnancy with anaemia.
Rx: Artemether-lumefantrine 80/480mg bd x 3/7, ferrous sulphate 200mg tds, folic acid 5mg daily.
Review in 2 weeks with repeat PCV.`;
    const f = await templateProvider.extractFindings({ text });
    const hb = get(f, 'haemoglobin');
    expect(hb).toHaveLength(1);
    expect(hb[0]).toMatch(/^8\.0 \(estimated from PCV 24%/);
    expect(f.find((x) => x.field === 'haemoglobin')?.confidence).toBe('medium');
    expect(get(f, 'temperature')).toEqual(['38.6']);
    expect(get(f, 'weight')).toEqual(['62']);
    expect(get(f, 'gestational_weeks')).toEqual(['26']);
    expect(get(f, 'diagnosis')).toEqual(expect.arrayContaining(['malaria', 'anaemia']));
    const meds = get(f, 'medication').join(' | ');
    expect(meds).toMatch(/artemether-lumefantrine/i);
    expect(meds).toMatch(/ferrous sulphate 200mg tds/);
    expect(meds).toMatch(/folic acid 5mg daily/);
    expect(get(f, 'follow_up')[0]).toMatch(/2 weeks/);
  });

  it('reads a GDM clinic letter and ignores ruled-out diagnoses', async () => {
    const text = `Dear colleague, thank you for referring this patient. At 28 weeks, OGTT 2h value 9.1 mmol/L.
Diagnosis: Gestational diabetes mellitus (GDM). No evidence of pre-eclampsia; UTI ruled out.
BP 118/76. Weight 94 kg. Started on Metformin 500 mg BD with meals; if poorly controlled will add insulin.
Follow-up at the diabetic ANC clinic in 2 weeks. Dr. A. Ibrahim, Consultant O&G`;
    const f = await templateProvider.extractFindings({ text });
    expect(get(f, 'systolic')).toEqual(['118']);
    expect(get(f, 'diastolic')).toEqual(['76']);
    expect(get(f, 'weight')).toEqual(['94']);
    const dx = get(f, 'diagnosis');
    expect(dx).toContain('gestational diabetes');
    expect(dx).not.toContain('pre-eclampsia');
    expect(dx).not.toContain('urinary tract infection');
    expect(get(f, 'medication').join(' | ')).toMatch(/metformin 500 mg BD/);
  });

  it('reads a postnatal discharge after PPH with Hb in g/dL', async () => {
    const text = `Postnatal discharge. SVD on 01-11-2026, complicated by primary PPH (EBL 1200 mls), managed with oxytocin and misoprostol, 2 units blood transfused.
Post-transfusion Hb: 9.4 g/dl. BP 110/70 mmHg. Temp 36.8.
Diagnosis: Primary postpartum haemorrhage secondary to uterine atony; UTI.
Discharge drugs: Haematinics (ferrous sulphate 200mg daily), amoxicillin 500mg tds x 5/7.
TCA PNC in 1/52.`;
    const f = await templateProvider.extractFindings({ text });
    expect(get(f, 'haemoglobin')).toEqual(['9.4']);
    expect(get(f, 'systolic')).toEqual(['110']);
    expect(get(f, 'temperature')).toEqual(['36.8']);
    const dx = get(f, 'diagnosis');
    expect(dx).toEqual(expect.arrayContaining(['postpartum haemorrhage', 'urinary tract infection']));
    const meds = get(f, 'medication').join(' | ');
    expect(meds).toMatch(/amoxicillin 500mg tds x 5\/7/);
    expect(meds).toMatch(/ferrous sulphate 200mg daily/);
    expect(meds).toMatch(/oxytocin/);
    expect(get(f, 'follow_up')[0]).toMatch(/PNC in 1 week/);
  });
});
