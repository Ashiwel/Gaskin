/**
 * Styles for the language components. Injected once into <head> so src/i18n stays self-contained.
 * Every colour comes from the app's semantic tokens (`--color-…`), so light and dark are both
 * right; the fallbacks after each token are other tokens, never literals. Class names are
 * prefixed `i18n-`. The look follows the Untitled UI components in src/components: 12px radii,
 * hairline rings instead of borders, pill badges with a dot.
 */
export const I18N_CSS = `
.i18n-badge{display:inline-flex;align-items:center;gap:.35em;font:500 .75rem/1.2 var(--font-body,system-ui);padding:.2em .6em;border-radius:999px;box-shadow:inset 0 0 0 1px var(--color-border-secondary);color:var(--color-text-secondary);background:var(--color-bg-primary);white-space:nowrap}
.i18n-badge-dot{width:.45em;height:.45em;border-radius:50%;background:currentColor}
.i18n-badge--reviewed{color:var(--color-text-success-primary);background:var(--color-bg-success-primary);box-shadow:inset 0 0 0 1px var(--color-border-success_subtle,var(--color-border-secondary))}
.i18n-badge--draft{color:var(--color-text-warning-primary);background:var(--color-bg-warning-primary);box-shadow:inset 0 0 0 1px var(--color-border-warning_subtle,var(--color-border-secondary))}
.i18n-badge--fallback{color:var(--color-text-secondary);background:var(--color-bg-secondary)}
.i18n-badge--compact{font-size:.7rem;padding:.12em .5em}
.i18n-badge-checked{font-weight:500}

.i18n-btn{display:inline-flex;align-items:center;justify-content:center;gap:.4em;font:600 .875rem/1 var(--font-body,system-ui);padding:.65em 1em;border-radius:12px;border:0;box-shadow:inset 0 0 0 1px var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-secondary);cursor:pointer;min-height:44px}
.i18n-btn:hover{background:var(--color-bg-primary_hover,var(--color-bg-secondary))}
.i18n-btn--primary{background:var(--color-bg-brand-solid);color:var(--color-text-on-fill);box-shadow:none}
.i18n-btn--primary:hover{background:var(--color-bg-brand-solid_hover,var(--color-bg-brand-solid))}
.i18n-link{font:600 .8125rem/1.2 var(--font-body,system-ui);background:none;border:0;padding:.35em .2em;color:var(--color-text-brand-secondary);cursor:pointer;min-height:32px;border-radius:6px}
.i18n-link:hover{color:var(--color-text-brand-secondary_hover,var(--color-text-brand-secondary));text-decoration:underline;text-underline-offset:2px}
.i18n-btn:focus-visible,.i18n-link:focus-visible,.i18n-pack-main:focus-visible,.i18n-picker-search:focus-visible{outline:2px solid var(--color-focus-ring);outline-offset:2px}

.i18n-picker{display:flex;flex-direction:column;gap:.75rem;font-family:var(--font-body,system-ui);color:var(--color-text-primary)}
.i18n-picker-label{font:600 .9375rem/1.3 var(--font-body,system-ui)}
.i18n-picker-search{font:inherit;font-size:1rem;padding:.7em .9em;border-radius:12px;border:0;box-shadow:inset 0 0 0 1px var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-primary);width:100%;box-sizing:border-box;min-height:44px}
.i18n-picker-hint{margin:0;font-size:.8125rem;color:var(--color-text-tertiary)}
.i18n-picker-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.5rem}
.i18n-picker-empty{color:var(--color-text-tertiary);font-size:.875rem;padding:.5rem 0}
.i18n-pack{border-radius:12px;background:var(--color-bg-primary);box-shadow:inset 0 0 0 1px var(--color-border-secondary);padding:.7rem .85rem;display:flex;flex-direction:column;gap:.4rem}
.i18n-pack.is-selected{box-shadow:inset 0 0 0 2px var(--color-border-brand)}
.i18n-pack-main{display:flex;align-items:center;gap:.7rem;width:100%;background:none;border:0;padding:0;text-align:start;cursor:pointer;color:inherit;font:inherit;min-height:44px;border-radius:8px}
.i18n-pack-tick{flex:none;width:1.25rem;height:1.25rem;border-radius:6px;box-shadow:inset 0 0 0 1.5px var(--color-border-primary);display:grid;place-items:center;font-size:.8rem;color:var(--color-text-on-fill)}
.is-selected .i18n-pack-tick{background:var(--color-bg-brand-solid);box-shadow:none}
.i18n-pack-names{display:flex;flex-direction:column;flex:1;min-width:0}
.i18n-pack-native{font:600 1rem/1.3 var(--font-body,system-ui)}
.i18n-pack-english{font-size:.8125rem;color:var(--color-text-tertiary)}
.i18n-status{flex:none;font:500 .75rem/1.2 var(--font-body,system-ui);padding:.2em .6em;border-radius:999px;background:var(--color-bg-secondary);color:var(--color-text-secondary)}
.i18n-status--reviewed{background:var(--color-bg-success-primary);color:var(--color-text-success-primary)}
.i18n-status--machine_draft,.i18n-status--partial{background:var(--color-bg-warning-primary);color:var(--color-text-warning-primary)}
.i18n-status--none{background:var(--color-bg-secondary);color:var(--color-text-tertiary)}
.i18n-pack-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .8rem;font-size:.8125rem;color:var(--color-text-tertiary);padding-inline-start:1.95rem}
.i18n-pack-action{margin-inline-start:auto;display:flex;align-items:center;gap:.5rem}
.i18n-installed{color:var(--color-text-success-primary);font-weight:600}
.i18n-progress{position:relative;display:inline-block;width:9rem;height:1.5rem;border-radius:999px;background:var(--color-bg-tertiary);overflow:hidden}
.i18n-progress-bar{position:absolute;inset-block:0;inset-inline-start:0;background:var(--color-bg-brand-secondary,var(--color-bg-success-primary));transition:width .15s linear}
.i18n-progress-label{position:relative;display:block;text-align:center;font:600 .72rem/1.5rem var(--font-body,system-ui);color:var(--color-text-primary)}
.i18n-pack-note,.i18n-pack-help,.i18n-pack-error{font-size:.8125rem;padding-inline-start:1.95rem}
.i18n-pack-note{color:var(--color-text-warning-primary)}
.i18n-pack-help{color:var(--color-text-brand-secondary);font-weight:600}
.i18n-pack-error{color:var(--color-text-error-primary)}

.i18n-dual{display:grid;grid-template-columns:1fr 1fr;border-radius:16px;background:var(--color-bg-primary);box-shadow:inset 0 0 0 1px var(--color-border-secondary);overflow:hidden;font-family:var(--font-body,system-ui);color:var(--color-text-primary)}
.i18n-dual--emergency,.i18n-dual--danger{box-shadow:inset 0 0 0 2px var(--color-border-error)}
.i18n-dual--urgent{box-shadow:inset 0 0 0 2px var(--color-border-warning_subtle,var(--color-border-error))}
.i18n-dual-side{padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.65rem;min-width:0}
.i18n-dual-mother{background:var(--color-bg-secondary)}
.i18n-dual-head{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .6rem}
.i18n-dual-kicker{font:600 .6875rem/1.2 var(--font-body,system-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-tertiary)}
.i18n-dual-heading{font:500 .8125rem/1.2 var(--font-body,system-ui);color:var(--color-text-secondary)}
.i18n-dual--emergency .i18n-dual-worker .i18n-dual-heading,.i18n-dual--danger .i18n-dual-worker .i18n-dual-heading{color:var(--color-text-error-primary)}
.i18n-dual-title{font:600 1rem/1.35 var(--font-body,system-ui);color:var(--color-text-primary)}
.i18n-dual-detail summary{cursor:pointer;font-size:.8125rem;font-weight:600;color:var(--color-text-tertiary);min-height:32px;display:flex;align-items:center;list-style:none}
.i18n-dual-detail summary::-webkit-details-marker{display:none}
.i18n-dual-detail summary::before{content:'';width:.4em;height:.4em;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);margin-inline-end:.55em;transition:transform .15s}
.i18n-dual-detail[open] summary::before{transform:rotate(45deg)}
.i18n-dual-detail p{margin:.35rem 0 0;font-size:.875rem;line-height:1.55;color:var(--color-text-secondary)}
.i18n-dual-plain{border-top:1px solid var(--color-border-secondary);padding-top:.65rem}
.i18n-dual-mother-body{display:flex;gap:1rem;align-items:flex-start}
.i18n-dual-mother-body .i18n-picto{border-radius:14px;background:var(--color-bg-primary);padding:6px;box-sizing:content-box}
.i18n-dual-mother-text{flex:1;min-width:0}
.i18n-dual-english{margin-top:.5rem;padding:.5rem .65rem;border-radius:10px;background:var(--color-bg-primary);font-size:.875rem;line-height:1.45;color:var(--color-text-secondary)}
.i18n-dual-note{margin:.5rem 0 0;font-size:.8125rem;color:var(--color-text-warning-primary)}
.i18n-line-text{margin:0;font-size:1rem;line-height:1.5;color:var(--color-text-primary)}
.i18n-line-text--large{font-size:1.125rem;line-height:1.5;font-weight:500}
.i18n-line-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .6rem;margin-top:.4rem}
.i18n-bt{margin:.35rem 0 0;font-size:.875rem;color:var(--color-text-secondary)}
.i18n-picto{display:inline-block;flex:none;line-height:0}
.i18n-picto svg{width:100%;height:100%}
@media (max-width:720px){
  .i18n-dual{grid-template-columns:1fr}
  .i18n-dual-mother-body{flex-direction:column;align-items:center;text-align:center}
  .i18n-dual-mother .i18n-line-meta{justify-content:center}
}

.i18n-show{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;background:var(--color-bg-secondary);color:var(--color-text-primary);font-family:var(--font-body,system-ui);padding:12px}
.i18n-show-worker{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.6rem 1rem;font-size:.875rem;border-radius:14px 14px 0 0;background:var(--color-bg-primary);color:var(--color-text-secondary);box-shadow:inset 0 -1px 0 var(--color-border-secondary)}
.i18n-show-worker--draft{background:var(--color-bg-warning-primary);color:var(--color-text-warning-primary)}
.i18n-show-worker--fallback{background:var(--color-bg-tertiary)}
.i18n-show-card{flex:1;overflow:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4rem;padding:1.5rem 1.25rem 2.5rem;text-align:center;background:var(--color-bg-primary);border-radius:0 0 24px 24px}
.i18n-show-card .i18n-picto{border-radius:32px;background:var(--color-bg-secondary);padding:20px;box-sizing:content-box}
.i18n-show--emergency .i18n-show-card,.i18n-show--danger .i18n-show-card{box-shadow:inset 0 6px 0 var(--color-fg-error-secondary)}
.i18n-show--urgent .i18n-show-card{box-shadow:inset 0 6px 0 var(--color-fg-warning-secondary)}
.i18n-show-name{font:600 1.125rem/1.2 var(--font-body,system-ui);color:var(--color-text-tertiary)}
.i18n-show-text{margin:0;max-width:24ch;font:600 clamp(1.6rem,6.5vw,2.5rem)/1.25 var(--font-body,system-ui);letter-spacing:-.01em}
.i18n-show-english{margin:0;max-width:40ch;font-size:1rem;line-height:1.45;color:var(--color-text-tertiary);border-top:1px solid var(--color-border-secondary);padding-top:.9rem}
@media (min-width:640px){.i18n-show{padding:32px}.i18n-show-worker,.i18n-show-card{max-width:720px;width:100%;margin-inline:auto}}
@media (prefers-reduced-motion:reduce){.i18n-progress-bar{transition:none}}
`;

let injected = false;

export function injectI18nStyles(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  try {
    const el = document.createElement('style');
    el.setAttribute('data-gaskin', 'i18n');
    el.textContent = I18N_CSS;
    document.head.appendChild(el);
  } catch {
    /* styles are optional */
  }
}
