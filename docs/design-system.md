# Gaskin design system

Gaskin's interface is built on Untitled UI React (MIT), copied into `src/components/` and adapted, with the Untitled UI PRO Figma file (`pRioanehUwWhgQfDdKtk2b`) as the visual reference. The aim is a modern application as Apple would draw it: generous white space, one clear thing per screen, pictures of the numbers before the numbers, and dark mode that is right everywhere. The living reference is the `#design` route, which renders every component and chart in the current theme (add `?scheme=both` to see light and dark side by side).

## What is where

| Path | What it holds |
|---|---|
| `src/styles/theme.css` | Every colour, radius, shadow and type token, light and dark. The only file allowed to hold colour values. |
| `src/styles/fonts.css` | Inter 4.1 as an embedded woff2 subset. Generated, never edited by hand. |
| `src/styles/globals.css` | The Tailwind entry: layers, the `dark` variant, base styles for body and form controls. |
| `src/theme/` | `ThemeProvider`, `useTheme()`, `bootTheme()`. |
| `src/components/base`, `application`, `foundations` | Untitled UI components (button, input, select, combobox, checkbox, toggle, radio, badge, avatar, tooltip, dropdown, progress, tabs, modal, slide-out, table, empty state, pagination, date picker, featured icon, loading indicator). |
| `src/components/application/notifications` | `Alert`, `Toast`, `ToastProvider`, written on Untitled's tokens because Untitled's own toast needs `sonner`. |
| `src/components/viz` | Gaskin's SVG chart primitives. |
| `src/components/shell` | `AppShell`, the worker card and menu, `PinLock`, `LegalFooter`, `GlobalSearch`, `ThemeToggle`, `AIPill`, `NotificationsButton`, the two navigation sets. |
| `src/design/DesignShowcase.tsx` | The `#design` route. |

Untitled UI files keep their kebab-case names and `Aria*` import convention. Gaskin files use PascalCase, as the rest of `src/ui` does.

## Dependencies

Every runtime dependency is pinned to an exact version and none is fetched at run time. Components are copied, not installed, so an upstream change cannot break a screen. Pinned: `react` and `react-dom` 19.3.1, `react-aria-components` 1.22.1, `react-aria` 3.53.1, `react-stately` 3.51.0, `@internationalized/date` 3.12.4, `tailwind-merge` 3.7.0, `@untitledui/icons` 0.0.23. Build-only: `tailwindcss-react-aria-components` 2.2.0, `tailwindcss-animate` 1.0.7, `@react-aria/optimize-locales-plugin` 2.1.0 (strips React Aria's built-in strings for locales Gaskin does not use). `lucide-react` was removed on 6 Nov once no screen imported it. There is no chart library.

## Colour

### Brand: Gaskin teal

The brand scale is a teal at OKLCH hue 192, stepped evenly in lightness from 25 to 950. Teal sits between the green of health and the blue of trust, it is calm without being clinical, and it is distinct from both the red used for danger and the amber used for warnings, so a brand-coloured button can never be mistaken for an alert. It also avoids the purple of Untitled's default and the terracotta of Gaskin's earlier look, which read as a warning colour next to amber badges.

| Step | Hex | White text on it |
|---|---|---|
| 500 | `#009b97` | 3.4:1 (icons and large text only) |
| 600 (`bg-brand-solid`) | `#007d7a` | 4.98:1 |
| 700 | `#006664` | 6.81:1 |

In dark mode the solid fill stays at 600 (white text still passes), brand text moves to 300 and brand icons to 400, all above 4.5:1 on the near-black surface.

### Neutral: Stone

Surfaces and text use Untitled's Stone grey from the Figma file, a neutral with a trace of warmth. Dark mode's page is Stone 950 (`#0c0a09`), cards are Stone 900, borders Stone 800.

### Clinical states

| State | Scale | Use |
|---|---|---|
| Danger, emergency, error | red (`error`) | Danger-sign alerts, overdue counts, destructive buttons, readings in the severe zone. |
| Warning, overdue | amber (`warning`) | Missed contacts, raised readings, draft translations. |
| Success, done | green (`success`) | Completed contacts, reviewed lines, delivered messages. |
| Information | brand or gray | Everything else. |

Danger never uses the brand colour, and a state is never shown by colour alone: it always carries a word or an icon too.

### Chart colours

`--color-chart-1` to `--color-chart-6` are a categorical order (teal, orange, blue, pink, amber, violet) with separate light and dark steps, validated for colour-blind separation and contrast against each surface. Assign them in order and never cycle; past four series, fold into "Other". Text on charts uses text tokens, never the series colour.

### Rules

1. Use semantic utilities: `bg-primary`, `bg-secondary`, `text-primary`, `text-secondary`, `text-tertiary`, `border-secondary`, `ring-secondary`, `fg-quaternary`, `bg-error-primary`, `text-error-primary`, `bg-brand-solid`, `text-on-fill`. In inline styles or SVG, use `var(--color-…)`.
2. Never write a hex, `rgb()`, `hsl()`, `bg-white`, `text-black` or a raw palette class such as `bg-gray-100`. `src/styles/no-hardcoded-colours.test.ts` fails the build if you do; its allowlist covers only the theme, the font, the printed handout and the pictogram palette.
3. Every surface has an explicit background (`bg-primary` for the page and cards, `bg-secondary` for wells and grouped lists). Inputs, text areas and selects get theirs from the base layer.
4. Shadows disappear in dark mode, so separate cards with a ring (`ring-1 ring-secondary`), not a shadow alone.

## Typography

Inter, embedded (latin, latin extended, IPA and combining marks, weights 400 to 700, about 90 KB woff2, 117 KB as base64). `python3 scripts/font/build-inter.py --check` confirms every Latin-script character in the source and language packs is covered: Yoruba ẹ ọ ṣ with tone marks, Igbo ị ọ ụ ṅ, Hausa ɓ ɗ ƙ ƴ, Twi ɛ ɔ, Ewe and Dagbani ɖ ƒ ŋ ɣ ʋ ʒ. Arabic and Chinese fall back to the system face.

| Role | Class | Size |
|---|---|---|
| Page title | `text-display-sm font-semibold` (desktop), `text-display-xs` (phone) | 30 / 24 px |
| Hero figure (one per view) | `text-display-md font-semibold` | 36 px |
| Section heading | `text-lg font-semibold` | 18 px |
| Card heading | `text-sm font-semibold` or `text-md font-semibold` | 14 / 16 px |
| Body | `text-md text-secondary` | 16 px |
| Supporting | `text-sm text-tertiary` | 14 px |
| Caption, axis | `text-xs text-tertiary` | 12 px |

Big standalone figures use proportional digits; columns of numbers use `tnum`.

## Layout

- Spacing follows Tailwind's 4 px scale. Use 4, 8, 12, 16, 24, 32, 48 and 64 px (`gap-1` to `gap-16`); avoid odd steps.
- Desktop (1024 px and wider): sidebar 272 px (76 px collapsed), content padded 32 px, maximum width 1280 px. Lay content on a 12-column grid (`grid grid-cols-12 gap-6`); KPI rows are 4 × 3 columns, a chart with its legend card is 8 + 4.
- Phone: 16 px gutters with safe-area insets, one column, bottom tab bar 64 px plus the safe area. Nothing may scroll sideways except deliberate strips (the calendar strip, filter chips).
- Cards only where they separate objects (a mother, a chart, a KPI). Lists of similar rows sit on the page with dividers, not in cards inside cards.
- Density: rows are at least 44 px tall; touch targets at least 44 × 44 px (PIN keys are 64 px).
- Restraint: one primary button per view (`color="primary"`); everything else is secondary, tertiary or a link. Lead with a visual summary (a KPI row, the journey line, the calendar strip), then the list, then detail behind a tap.

## Copy

Follow `tasks/style.md` (British English, the Oxford comma, no em dashes, plain words). In the interface specifically: sentence case everywhere, buttons say what they do ("Save visit", not "Submit"), numbers as digits, and say who acts ("Call her before Friday"). Avoid the house-style banned words in labels as well as in prose.

## Dark mode

- `ThemeProvider` resolves `'system' | 'light' | 'dark'`, saved per device under `gaskin.theme.v1`. In system mode inside the claude.ai Artifact viewer, the host's `data-theme` on `<html>` wins (watched with a `MutationObserver`); otherwise `prefers-color-scheme` decides.
- It applies `.dark-mode` to `<html>`, plus `data-gaskin-theme` and `color-scheme`, before React renders (`bootTheme()` in `main.tsx`), so there is no light flash.
- Use the `dark:` variant only for a deliberate difference; tokens already switch. A `.dark-mode` element inside the page also switches its subtree, which the showcase uses.
- The setting lives in the top bar (`ThemeToggle`) and should appear in Settings as `ThemeSegmented`.
- The legacy tokens in `src/index.css` (`--paper`, `--ink`, `--clay` …) now point at the semantic tokens, so unredesigned screens already follow the theme. Do not use them in new code.

## Charts (`src/components/viz`)

All are SVG, take numbers as props, size to their container, label themselves with `role="img"` and an `aria-label` that states the values, and respect reduced motion.

| Component | Use |
|---|---|
| `Sparkline` | A trend the size of a word, in a KPI tile or a table row. |
| `AreaChart` | One to four series over time, faint grid, last values labelled, crosshair on hover. |
| `BarChart` | Counts by category; `orientation="horizontal"` for long labels; `tone="danger"` for a bar that is a danger count. |
| `DonutChart`, `ProgressRing` | Parts of a whole (five slices at most) and one share of a target. |
| `StackedBar` | A whole split into parts, thin (8 px meter) or tall (28 px, shares printed inside). |
| `JourneyTimeline` | Conception to day 1,000 with contacts as done, due, overdue, missed or upcoming, and today. `compact` for headers. |
| `RiskGauge` | A level from the rules engine shown as a gauge, with the level word. |
| `KpiTile` | Label, figure, signed change against a named period (coloured by whether up is good), and a sparkline. |
| `CalendarStrip` | The next 14 days with contacts due, red when any is urgent; keyboard arrows move. |
| `GrowthChart` | WHO median and the −2 to +2 SD band (reference passed in), with the child's points; points outside the band turn red. |
| `BPChart` | Readings over normal, raised (140/90) and severe (160/110) zones, each zone named. |

## The shell (`src/components/shell`)

`AppShell` takes plain data and callbacks. App.tsx fills it today; `src/auth` and `src/legal` will supply the worker, the menu actions and the legal text when they land.

- Navigation, health-worker mode: Today, Mothers, Visits, Messages, Review, Insights, Library, with Settings and About at the foot of the sidebar. The tab bar shows the first four and puts the rest under More.
- Navigation, personal mode (a mother using Gaskin for herself): My plan, My baby, Visits, Messages, Settings, About, and `LegalFooter` with the emergency number on every page.
- Worker menu (sidebar card on desktop, avatar in the phone top bar): switch worker, add a worker, settings, lock, log out. Each item shows only when its callback is given. Wire `onLock` to show `PinLock`, and `onSubmit` to `src/auth`'s PIN check.
- Top bar: global search (`/` or Ctrl+K), AI status pill, theme, notifications. Screens do not draw their own app headers.

## Page template for screen agents

```tsx
import { Button } from '../components/base/buttons/button';
import { KpiTile, CalendarStrip } from '../components/viz';

export function Visits() {
  return (
    <div className="mx-auto grid max-w-[1280px] gap-8">
      {/* 1. Header: title, one line of context, one primary action */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display-xs font-semibold text-primary lg:text-display-sm">Visits this fortnight</h1>
          <p className="mt-1 text-md text-tertiary">Twelve contacts due, two of them overdue.</p>
        </div>
        <Button iconLeading={Plus}>Record a visit</Button>
      </header>

      {/* 2. Visual summary */}
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Due this week" value="12" delta={3} period="vs last week" trend={[…]} />
        …
      </section>
      <CalendarStrip start={today} days={days} selected={day} onSelect={setDay} />

      {/* 3. The list: rows on the page, dividers between, no nested cards */}
      <section aria-labelledby="due-h">
        <h2 id="due-h" className="text-lg font-semibold text-primary">Due on Thursday</h2>
        <ul className="mt-3 divide-y divide-border-secondary">…</ul>
      </section>

      {/* 4. Detail opens in a SlideoutMenu or a Modal, never a new page for a small edit */}
    </div>
  );
}
```

Checklist before handing a screen back:

1. `npm test` passes, including the colour-literal test.
2. The screen looks right at 390 px and 1440 px in light and dark (`node scripts/design-shots.mjs` shows how to drive Playwright; add your screen to it or to the walk-through).
3. No horizontal scroll, every target at least 44 px, every icon-only button has an `aria-label`.
4. One primary action; danger in red with a word; numbers summarised in a chart before they are listed.
5. Legacy classes (`.btn`, `.chip`, `.card`, `var(--ink)` …) removed from the screen you redesigned and icons from `@untitledui/icons` only.
