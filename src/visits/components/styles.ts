/**
 * Styles for the guided visit. The components are styled with the app's semantic Tailwind
 * utilities; the `visit-` class names stay as stable hooks for tests and the walk-through. This
 * sheet holds only what utilities cannot express. Every colour is a theme token.
 */
export const VISIT_CSS = `
.visit-root{font-family:var(--font-body,system-ui)}
.visit-steps{scrollbar-width:none}
.visit-steps::-webkit-scrollbar{display:none}
.visit-root input[type=number]::-webkit-outer-spin-button,.visit-root input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.visit-root details>summary{list-style:none}
.visit-root details>summary::-webkit-details-marker{display:none}
.visit-mother-sub::before{content:'• ';color:var(--color-fg-quaternary)}
@media (prefers-reduced-motion:reduce){.visit-progress-bar{transition:none}}
`;
