/**
 * Styles for the language components. Injected once into <head> so src/i18n stays self-contained;
 * every colour, radius and font comes from the app theme's custom properties, with fallbacks.
 * Class names are prefixed `i18n-` so the UI theme can override them.
 */
export const I18N_CSS = `
.i18n-badge{display:inline-flex;align-items:center;gap:.35em;font:600 .72rem/1.2 var(--sans,system-ui);padding:.2em .55em;border-radius:999px;border:1px solid var(--line-2,#d0c3ab);color:var(--ink-2,#4f463b);background:var(--card,#fbf8f1);white-space:nowrap}
.i18n-badge-dot{width:.5em;height:.5em;border-radius:50%;background:currentColor}
.i18n-badge--reviewed{color:var(--green,#2d5b45);background:var(--green-soft,#dde8de);border-color:transparent}
.i18n-badge--draft{color:var(--amber,#9a6110);background:var(--amber-soft,#f6e6c4);border-color:transparent}
.i18n-badge--fallback{color:var(--ink-2,#4f463b);background:var(--paper-sunk,#eee6d6);border-color:transparent}
.i18n-badge--compact{font-size:.66rem;padding:.1em .45em}
.i18n-badge-checked{font-weight:500}

.i18n-btn{font:600 .85rem/1 var(--sans,system-ui);padding:.6em .95em;border-radius:var(--r-m,10px);border:1px solid var(--line-2,#d0c3ab);background:var(--raised,#fffdf8);color:var(--ink,#221d17);cursor:pointer;min-height:40px}
.i18n-btn:hover{background:var(--paper-sunk,#eee6d6)}
.i18n-btn--primary{background:var(--ink,#221d17);color:var(--paper,#f6f1e6);border-color:transparent}
.i18n-btn--primary:hover{background:var(--clay-ink,#8a3a20)}
.i18n-link{font:600 .8rem/1.2 var(--sans,system-ui);background:none;border:0;padding:.35em .2em;color:var(--clay-ink,#8a3a20);text-decoration:underline;text-underline-offset:2px;cursor:pointer;min-height:32px}
.i18n-btn:focus-visible,.i18n-link:focus-visible,.i18n-pack-main:focus-visible,.i18n-picker-search:focus-visible{outline:2px solid var(--focus,#a3482a);outline-offset:2px}

.i18n-picker{display:flex;flex-direction:column;gap:.6rem;font-family:var(--sans,system-ui);color:var(--ink,#221d17)}
.i18n-picker-label{font:600 .95rem/1.3 var(--sans,system-ui)}
.i18n-picker-search{font:inherit;font-size:1rem;padding:.65em .8em;border-radius:var(--r-m,10px);border:1px solid var(--line-2,#d0c3ab);background:var(--raised,#fffdf8);color:var(--ink,#221d17);width:100%;box-sizing:border-box}
.i18n-picker-hint{margin:0;font-size:.8rem;color:var(--ink-3,#7b7062)}
.i18n-picker-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.5rem}
.i18n-picker-empty{color:var(--ink-3,#7b7062);font-size:.9rem;padding:.5rem 0}
.i18n-pack{border:1px solid var(--line,#e3d9c6);border-radius:var(--r-m,10px);background:var(--card,#fbf8f1);padding:.6rem .75rem;display:flex;flex-direction:column;gap:.35rem}
.i18n-pack.is-selected{border-color:var(--ink-2,#4f463b);box-shadow:inset 0 0 0 1px var(--ink-2,#4f463b)}
.i18n-pack-main{display:flex;align-items:center;gap:.65rem;width:100%;background:none;border:0;padding:0;text-align:start;cursor:pointer;color:inherit;font:inherit;min-height:40px}
.i18n-pack-tick{flex:none;width:1.4rem;height:1.4rem;border-radius:6px;border:1.5px solid var(--line-2,#d0c3ab);display:grid;place-items:center;font-size:.85rem;color:var(--paper,#f6f1e6)}
.is-selected .i18n-pack-tick{background:var(--ink,#221d17);border-color:var(--ink,#221d17)}
.i18n-pack-names{display:flex;flex-direction:column;flex:1;min-width:0}
.i18n-pack-native{font:600 1.05rem/1.25 var(--serif,Georgia,serif)}
.i18n-pack-english{font-size:.8rem;color:var(--ink-3,#7b7062)}
.i18n-status{flex:none;font:600 .7rem/1.2 var(--sans,system-ui);padding:.25em .55em;border-radius:999px;background:var(--paper-sunk,#eee6d6);color:var(--ink-2,#4f463b)}
.i18n-status--reviewed{background:var(--green-soft,#dde8de);color:var(--green,#2d5b45)}
.i18n-status--machine_draft,.i18n-status--partial{background:var(--amber-soft,#f6e6c4);color:var(--amber,#9a6110)}
.i18n-pack-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .8rem;font-size:.78rem;color:var(--ink-3,#7b7062);padding-inline-start:2.05rem}
.i18n-pack-action{margin-inline-start:auto;display:flex;align-items:center;gap:.5rem}
.i18n-installed{color:var(--green,#2d5b45);font-weight:600}
.i18n-progress{position:relative;display:inline-block;width:9rem;height:1.5rem;border-radius:999px;background:var(--paper-sunk,#eee6d6);overflow:hidden}
.i18n-progress-bar{position:absolute;inset-block:0;inset-inline-start:0;background:var(--green-soft,#dde8de);transition:width .15s linear}
.i18n-progress-label{position:relative;display:block;text-align:center;font:600 .72rem/1.5rem var(--sans,system-ui);color:var(--ink,#221d17)}
.i18n-pack-note,.i18n-pack-help,.i18n-pack-error{font-size:.78rem;padding-inline-start:2.05rem}
.i18n-pack-note{color:var(--amber,#9a6110)}
.i18n-pack-help{color:var(--clay-ink,#8a3a20);font-weight:600}
.i18n-pack-error{color:var(--red,#b0261d)}

.i18n-dual{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--line,#e3d9c6);border-radius:var(--r-l,14px);background:var(--card,#fbf8f1);overflow:hidden;font-family:var(--sans,system-ui);color:var(--ink,#221d17)}
.i18n-dual--emergency,.i18n-dual--danger{border-color:var(--red,#b0261d)}
.i18n-dual--urgent{border-color:var(--amber,#9a6110)}
.i18n-dual-side{padding:1rem;display:flex;flex-direction:column;gap:.6rem;min-width:0}
.i18n-dual-mother{background:var(--raised,#fffdf8);border-inline-start:1px solid var(--line,#e3d9c6)}
.i18n-dual-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.4rem .6rem}
.i18n-dual-kicker{font:600 .68rem/1.2 var(--sans,system-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#7b7062)}
.i18n-dual-heading{font:600 .85rem/1.2 var(--sans,system-ui);color:var(--ink-2,#4f463b)}
.i18n-dual--emergency .i18n-dual-worker .i18n-dual-heading,.i18n-dual--danger .i18n-dual-worker .i18n-dual-heading{color:var(--red,#b0261d)}
.i18n-dual-title{font:600 1.1rem/1.3 var(--serif,Georgia,serif)}
.i18n-dual-detail summary{cursor:pointer;font-size:.8rem;color:var(--ink-2,#4f463b);min-height:28px}
.i18n-dual-detail p{margin:.4rem 0 0;font-size:.9rem;line-height:1.5;color:var(--ink-2,#4f463b)}
.i18n-dual-plain{border-top:1px dashed var(--line,#e3d9c6);padding-top:.6rem}
.i18n-dual-mother-body{display:flex;gap:.9rem;align-items:flex-start}
.i18n-dual-mother-text{flex:1;min-width:0}
.i18n-dual-english{margin-top:.5rem;padding:.45rem .6rem;border-radius:var(--r-s,6px);background:var(--paper-sunk,#eee6d6);font-size:.9rem;line-height:1.45}
.i18n-dual-note{margin:.5rem 0 0;font-size:.78rem;color:var(--amber,#9a6110)}
.i18n-line-text{margin:0;font-size:1rem;line-height:1.5}
.i18n-line-text--large{font-size:1.15rem;line-height:1.5}
.i18n-line-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .6rem;margin-top:.35rem}
.i18n-bt{margin:.35rem 0 0;font-size:.85rem;color:var(--ink-2,#4f463b);font-style:italic}
.i18n-picto{display:inline-block;flex:none;line-height:0}
.i18n-picto svg{width:100%;height:100%}
@media (max-width:720px){
  .i18n-dual{grid-template-columns:1fr}
  .i18n-dual-mother{border-inline-start:0;border-top:1px solid var(--line,#e3d9c6)}
  .i18n-dual-mother-body{flex-direction:column;align-items:center;text-align:center}
  .i18n-dual-mother .i18n-line-meta{justify-content:center}
}

.i18n-show{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;background:var(--raised,#fffdf8);color:var(--ink,#221d17);font-family:var(--sans,system-ui)}
.i18n-show-worker{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.6rem 1rem;font-size:.85rem;background:var(--paper-sunk,#eee6d6);color:var(--ink-2,#4f463b)}
.i18n-show-worker--draft{background:var(--amber-soft,#f6e6c4);color:var(--amber,#9a6110)}
.i18n-show-worker--fallback{background:var(--paper-sunk,#eee6d6)}
.i18n-show-card{flex:1;overflow:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2rem;padding:1.5rem 1.25rem 2.5rem;text-align:center}
.i18n-show--emergency .i18n-show-card{box-shadow:inset 0 6px 0 var(--red,#b0261d)}
.i18n-show--urgent .i18n-show-card{box-shadow:inset 0 6px 0 var(--amber,#9a6110)}
.i18n-show-name{font:600 1.1rem/1.2 var(--sans,system-ui);color:var(--ink-2,#4f463b)}
.i18n-show-text{margin:0;max-width:30ch;font:600 clamp(1.5rem,6vw,2.4rem)/1.35 var(--serif,Georgia,serif)}
.i18n-show-english{margin:0;max-width:40ch;font-size:1rem;line-height:1.45;color:var(--ink-2,#4f463b);border-top:1px solid var(--line,#e3d9c6);padding-top:.8rem}
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
