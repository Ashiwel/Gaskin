import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Alert } from '../types';
import { DualLanguageView, LanguagePicker } from './index';

const alert: Alert = {
  id: 'alert.postpartum_haemorrhage',
  level: 'emergency',
  title: 'Postpartum haemorrhage',
  action: 'Uterine massage, oxytocin, refer now.',
  reason: 'Estimated loss 800 ml.',
  sources: [],
  subject: 'mother',
  motherTextKey: 'alert.postpartum_haemorrhage',
};

describe('components (server render)', () => {
  it('DualLanguageView shows both languages, the badge and the English line for a draft danger line', () => {
    const html = renderToStaticMarkup(<DualLanguageView alert={alert} workerLang="en" motherLang="sw" />);
    expect(html).toContain('Damu nyingi baada ya kujifungua ni hatari sana');
    expect(html).toContain('Heavy bleeding after birth is very dangerous');
    expect(html).toContain('i18n-badge--draft');
    expect(html).toContain('<svg');
    expect(html).toContain('lang="sw"');
  });

  it('sets dir="rtl" on Arabic containers', () => {
    const html = renderToStaticMarkup(<DualLanguageView alert={alert} workerLang="ar" motherLang="ar" />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('طارئ');
  });

  it('LanguagePicker lists native names and pack status', () => {
    const html = renderToStaticMarkup(<LanguagePicker uiLang="en" value={['en']} multiple onChange={() => {}} />);
    expect(html).toContain('Yorùbá');
    expect(html).toContain('العربية');
    expect(html).toContain('Draft, needs review');
    expect(html).toContain('English for now');
    expect(html).toContain('Help build this pack');
  });

  it('LanguagePicker hides Pidgin when asked', () => {
    const html = renderToStaticMarkup(<LanguagePicker uiLang="en" value="en" onChange={() => {}} hidePidgin />);
    expect(html).not.toContain('Nigerian Pidgin');
  });
});
