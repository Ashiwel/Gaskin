/**
 * Styles for the guided visit. Injected once; every colour, radius and font comes from the app
 * theme's custom properties (with fallbacks), so light and dark themes apply. Classes are `visit-`.
 * Touch targets are at least 48px tall.
 */
export const VISIT_CSS = `
.visit-root{display:flex;flex-direction:column;min-height:100%;background:var(--paper,#f6f1e6);color:var(--ink,#221d17);font:400 1rem/1.45 var(--sans,system-ui)}
.visit-head{display:flex;align-items:flex-start;gap:12px;padding:12px var(--gutter,16px) 8px}
.visit-head-title{flex:1;min-width:0}
.visit-eyebrow{font:600 .78rem/1.3 var(--sans,system-ui);color:var(--clay-ink,#8a3a20);text-transform:uppercase;letter-spacing:.04em}
.visit-who{font:600 1.15rem/1.3 var(--serif,Georgia,serif);display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:2px}
.visit-chip{font:500 .78rem/1.2 var(--sans,system-ui);background:var(--paper-sunk,#eee6d6);border-radius:999px;padding:.25em .6em;color:var(--ink-2,#4f463b)}
.visit-link{background:none;border:0;color:var(--clay-ink,#8a3a20);font:600 .9rem/1 var(--sans,system-ui);min-height:44px;padding:0 4px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.visit-steps{display:flex;gap:6px;overflow-x:auto;padding:4px var(--gutter,16px) 8px;scrollbar-width:none}
.visit-steps::-webkit-scrollbar{display:none}
.visit-step{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:48px;padding:6px 12px;border-radius:var(--r-m,10px);border:1px solid var(--line,#e3d9c6);background:var(--card,#fbf8f1);color:var(--ink-2,#4f463b);font:600 .82rem/1.2 var(--sans,system-ui);cursor:pointer}
.visit-step.is-current{background:var(--ink,#221d17);color:var(--paper,#f6f1e6);border-color:transparent}
.visit-step.is-done:not(.is-current){border-color:var(--green,#2d5b45)}
.visit-step.is-flagged:not(.is-current){border-color:var(--red,#b0261d);color:var(--red,#b0261d)}
.visit-step-count{font-weight:500;font-size:.72rem;opacity:.8}
.visit-progress{height:4px;background:var(--line,#e3d9c6);margin:0 var(--gutter,16px)}
.visit-progress-bar{height:100%;background:var(--green,#2d5b45);transition:width .2s}
.visit-personal{margin:10px var(--gutter,16px) 0;padding:10px 12px;background:var(--clay-soft,#f2dfd2);border-radius:var(--r-m,10px);font-size:.88rem}
.visit-personal summary{font-weight:600;cursor:pointer;min-height:32px;display:flex;align-items:center}
.visit-personal ul{margin:6px 0 0;padding-left:1.1em}
.visit-body{flex:1;padding:12px var(--gutter,16px) 96px}
.visit-h2{font:600 1.35rem/1.25 var(--serif,Georgia,serif);margin:4px 0 2px}
.visit-h3{font:700 .9rem/1.3 var(--sans,system-ui);margin:16px 0 6px;color:var(--ink-2,#4f463b)}
.visit-hint{margin:0 0 12px;color:var(--ink-3,#7b7062);font-size:.9rem}
.visit-item{background:var(--card,#fbf8f1);border:1px solid var(--line,#e3d9c6);border-radius:var(--r-l,16px);padding:14px;margin:0 0 12px;box-shadow:var(--shadow,none)}
.visit-item.is-p1{border-left:4px solid var(--clay,#a3482a)}
.visit-item.is-answered{border-color:var(--green-soft,#dde8de)}
.visit-item.is-abnormal{border-color:var(--red,#b0261d);background:var(--red-soft,#f9ddd8)}
.visit-item-head{display:flex;gap:10px;align-items:flex-start}
.visit-item-titles{flex:1;min-width:0}
.visit-item-title{font:650 1.02rem/1.3 var(--sans,system-ui);margin:0}
.visit-how{margin:4px 0 0;font-size:.88rem;color:var(--ink-2,#4f463b)}
.visit-because{margin:4px 0 0;font-size:.8rem;color:var(--clay-ink,#8a3a20);font-weight:600}
.visit-pict{flex:0 0 44px;width:44px;height:44px;display:block;border-radius:var(--r-s,6px);overflow:hidden}
.visit-pict svg{width:100%;height:100%;display:block}
.visit-toggle,.visit-multi{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.visit-toggle--stack{flex-direction:column}
.visit-opt{flex:1 1 140px;min-height:48px;padding:10px 12px;border-radius:var(--r-m,10px);border:1.5px solid var(--line-2,#d0c3ab);background:var(--raised,#fffdf8);color:var(--ink,#221d17);font:600 .92rem/1.25 var(--sans,system-ui);text-align:left;cursor:pointer}
.visit-opt--ok.is-on{background:var(--green,#2d5b45);border-color:var(--green,#2d5b45);color:var(--paper,#fff)}
.visit-opt--bad.is-on{background:var(--red,#b0261d);border-color:var(--red,#b0261d);color:var(--red-ink,#fff)}
.visit-opt--neutral.is-on,.visit-opt.is-on:not(.visit-opt--ok):not(.visit-opt--bad){background:var(--ink,#221d17);border-color:var(--ink,#221d17);color:var(--paper,#f6f1e6)}
.visit-opt:focus-visible,.visit-btn:focus-visible,.visit-step:focus-visible,.visit-num-input:focus-visible{outline:2px solid var(--focus,#a3482a);outline-offset:2px}
.visit-num{margin-top:12px;display:flex;flex-direction:column;gap:4px}
.visit-num-row{display:flex;align-items:center;gap:8px}
.visit-num-input{width:7.5em;min-height:52px;font:600 1.35rem/1 var(--sans,system-ui);padding:6px 10px;border-radius:var(--r-m,10px);border:1.5px solid var(--line-2,#d0c3ab);background:var(--raised,#fffdf8);color:var(--ink,#221d17)}
.visit-date{width:auto;font-size:1.05rem}
.visit-bp .visit-num-input{width:5em}
.visit-bp-slash{font:600 1.5rem/1 var(--sans,system-ui);color:var(--ink-3,#7b7062)}
.visit-unit{font:600 .95rem/1 var(--sans,system-ui);color:var(--ink-2,#4f463b)}
.visit-normal{font-size:.8rem;color:var(--ink-3,#7b7062)}
.visit-finding{margin-top:10px;padding:10px 12px;border-radius:var(--r-m,10px);background:var(--raised,#fffdf8);border:1px solid var(--line-2,#d0c3ab);font-size:.9rem}
.visit-finding--emergency{border-color:var(--red,#b0261d);border-width:2px}
.visit-finding--urgent{border-color:var(--amber,#9a6110)}
.visit-action{display:inline-block;font:700 .72rem/1 var(--sans,system-ui);text-transform:uppercase;letter-spacing:.04em;padding:.3em .5em;border-radius:4px;margin-right:4px;background:var(--paper-sunk,#eee6d6)}
.visit-action--refer{background:var(--red,#b0261d);color:var(--red-ink,#fff)}
.visit-action--treat{background:var(--amber-soft,#f6e6c4);color:var(--amber,#9a6110)}
.visit-action--recheck{background:var(--green-soft,#dde8de);color:var(--green,#2d5b45)}
.visit-why{margin-top:10px;font-size:.85rem;color:var(--ink-2,#4f463b)}
.visit-why summary{cursor:pointer;min-height:36px;display:flex;align-items:center;font-weight:600;color:var(--clay-ink,#8a3a20)}
.visit-why p{margin:4px 0}
.visit-sources{margin:4px 0 0;padding-left:1.1em;font-size:.78rem;color:var(--ink-3,#7b7062)}
.visit-sources a{color:inherit}
.visit-mother{display:flex;gap:10px;margin-top:10px;padding:12px;border-radius:var(--r-m,10px);background:var(--bubble-out,#d9f0d0);color:var(--ink,#221d17)}
.visit-mother--compact{padding:8px 10px;background:var(--paper-sunk,#eee6d6)}
.visit-mother-text{flex:1;min-width:0}
.visit-mother-lead{margin:0;font:500 1.05rem/1.45 var(--sans,system-ui)}
.visit-mother--compact .visit-mother-lead{font-size:.9rem}
.visit-mother-sub{margin:4px 0 0;font-size:.98rem}
.visit-mother-sub::before{content:'• '}
.visit-mother-sub:last-of-type::before{content:''}
.visit-mother-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}
.visit-english{font-size:.78rem;color:var(--ink-3,#7b7062)}
.visit-epds{margin:12px 0 0;padding-left:1.3em}
.visit-epds li{margin-bottom:12px}
.visit-epds .is-self-harm .visit-epds-q{color:var(--red,#b0261d)}
.visit-epds-q{margin:0 0 6px;font-weight:600}
.visit-epds-total{list-style:none;font-weight:700;margin-left:-1.3em}
.visit-book{margin-top:8px}
.visit-foot{position:sticky;bottom:0;display:flex;gap:10px;padding:10px var(--gutter,16px) max(10px,env(safe-area-inset-bottom,0px));background:var(--paper,#f6f1e6);border-top:1px solid var(--line,#e3d9c6)}
.visit-btn{flex:1;min-height:52px;border-radius:var(--r-m,10px);font:700 1rem/1 var(--sans,system-ui);cursor:pointer;border:1.5px solid var(--line-2,#d0c3ab)}
.visit-btn--ghost{background:var(--raised,#fffdf8);color:var(--ink,#221d17)}
.visit-btn--primary{background:var(--clay,#a3482a);color:var(--paper,#fff);border-color:transparent;flex:2}
.visit-ok{padding:12px;border-radius:var(--r-m,10px);background:var(--green-soft,#dde8de);color:var(--green,#2d5b45);font-weight:600}
.visit-sum-block{padding:4px 12px 8px;border-radius:var(--r-m,10px);margin-bottom:10px;border:1px solid var(--line,#e3d9c6);background:var(--card,#fbf8f1)}
.visit-sum-block ul{margin:0;padding-left:1.1em}
.visit-sum-block li{margin:6px 0}
.visit-sum-block--refer{border-color:var(--red,#b0261d);background:var(--red-soft,#f9ddd8)}
.visit-sum-block--treat{border-color:var(--amber,#9a6110)}
.visit-sum-block--missing{border-style:dashed}
.visit-pill{display:inline-block;margin-left:6px;font:700 .7rem/1 var(--sans,system-ui);padding:.3em .55em;border-radius:999px;background:var(--red,#b0261d);color:var(--red-ink,#fff)}
.visit-pill--urgent{background:var(--amber,#9a6110)}
.visit-what{font-size:.92rem;color:var(--ink-2,#4f463b)}
@media (min-width:720px){.visit-body{max-width:720px}.visit-opt{flex-basis:200px}}
`;
