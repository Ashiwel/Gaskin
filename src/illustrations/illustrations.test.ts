import { describe, expect, it } from 'vitest';
import { HANDOUT_CSP, ILLUSTRATION_KEYS, renderHandoutHTML, renderIllustration } from './index';
import { sampleHandoutInput } from './sample';

describe('renderIllustration', () => {
  it('covers all 36 keys with unique entries', () => {
    expect(ILLUSTRATION_KEYS.length).toBe(36);
    expect(new Set(ILLUSTRATION_KEYS).size).toBe(36);
  });

  it.each(ILLUSTRATION_KEYS)('%s renders accessible SVG', (key) => {
    const svg = renderIllustration(key, { size: 64 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 120 120"');
    expect(svg).toContain('role="img"');
    expect(svg).toMatch(/<title>[^<]+<\/title>/);
    expect(svg).toContain('width="64"');
    expect(svg).not.toContain('undefined');
    expect(svg).not.toContain('NaN');
    expect(svg.length).toBeGreaterThan(600);
    // tags balance (rough well-formedness check)
    const opens = (svg.match(/<(?!\/)[a-zA-Z][^>]*[^/]>/g) ?? []).length;
    const closes = (svg.match(/<\/[a-zA-Z]+>/g) ?? []).length;
    expect(opens).toBe(closes);
  });

  it('danger pictograms carry the alert badge', () => {
    for (const k of ILLUSTRATION_KEYS.filter((k) => k.startsWith('danger_') || k === 'baby_danger')) {
      expect(renderIllustration(k)).toContain('#E0442A');
    }
  });

  it('escapes a custom title', () => {
    const svg = renderIllustration('calendar', { title: '<b>x</b> & "y"' });
    expect(svg).toContain('<title>&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;</title>');
  });
});

describe('renderHandoutHTML', () => {
  it('produces a standalone A4 document', () => {
    const html = renderHandoutHTML(sampleHandoutInput());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('@page { size: A4');
    expect(html).toContain('<title>Gaskin – Amina</title>');
    expect(html).toContain('31 weeks pregnant');
    expect(html).toContain('Danger signs');
    expect(html).toContain('Call 112');
    expect(html).toContain('Next visit');
    expect(html).toContain('Prepared with Gaskin. Bring this sheet to your next visit.');
    expect((html.match(/<article class="card/g) ?? []).length).toBe(7);
    expect(html).not.toMatch(/(src|href)=["']https?:/);
    expect(html).not.toContain('@import');
    expect(html).not.toContain('<script');
  });

  it("escapes '<script>' in a mother's name and other user text", () => {
    const input = sampleHandoutInput('<script>alert(1)</script> Bello');
    input.workerName = '<img src=x onerror=alert(1)>';
    input.translated = { [input.items[0].id]: '</p><script>bad()</script>' };
    const html = renderHandoutHTML(input);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;/p&gt;&lt;script&gt;bad()&lt;/script&gt;');
  });

  it('security: an unknown or crafted illustration key never reaches the markup (SEC-01)', () => {
    const evil = 'x"><script>alert(1)</script><img src=x onerror=alert(2)>';
    const svg = renderIllustration(evil as never, { size: '1" onload="alert(3)' as never });
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('<img');
    expect(svg).not.toContain('onload');
    expect(svg).toContain('data-illustration="unknown"');
    expect(svg).toContain('width="120"');
    // A prototype key is not a drawing either
    expect(renderIllustration('constructor' as never)).toContain('data-illustration="unknown"');

    const input = sampleHandoutInput();
    input.items[0] = { ...input.items[0], illustration: evil as never };
    const html = renderHandoutHTML(input);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror');
  });

  it('security: the handout carries a CSP that forbids scripts and network, and sets dir for Arabic', () => {
    const html = renderHandoutHTML({ ...sampleHandoutInput(), language: 'ar' });
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${HANDOUT_CSP}">`);
    expect(HANDOUT_CSP).toContain("default-src 'none'");
    expect(HANDOUT_CSP).not.toMatch(/script-src|unsafe-eval/);
    expect(html).toMatch(/<html lang="ar" dir="rtl">/);
    expect(renderHandoutHTML(sampleHandoutInput())).toMatch(/<html lang="[a-z]+" dir="ltr">/);
  });

  it('uses the infant stage line after birth', () => {
    const input = sampleHandoutInput();
    input.plan.state = { ...input.plan.state, stage: 'postpartum', gestationalWeeks: undefined, infantAgeDays: 5, daysPostpartum: 5 };
    expect(renderHandoutHTML(input)).toContain('Baby is 5 days old');
  });
});
