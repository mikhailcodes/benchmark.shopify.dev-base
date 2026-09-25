# __NS_TITLE__ design system

Tokens, components, and how they override Horizon.

**Source of truth: Figma.** __NS_TITLE__'s frames are not wired into this file yet.

> **Placeholder values.** The `$palette`, `$scale` and `$glass` maps currently
> hold the values this layer was ported with, not __NS_TITLE__'s. The machinery is
> __NS_TITLE__'s: `u.rem`, `u.fluid`, `u.role`, `u.type`, `u.min` and the three-tier
> primitives → roles → component-properties split. Re-point the maps in
> `utils/_colors.scss`, `utils/_type.scss` and `utils/_tokens.scss` against the
> __NS_TITLE__ Style Sheet frame, then replace this note with the frame link and an
> audit date. Nothing below the token tables should need to change.

---eComm---Marketing?node-id=40012230-16377)
so code has something to compile against. When the two disagree, Figma wins and
this file is corrected in the same commit.

Last audited against Figma: **2026-09-17**. Colour, type and the three button
variants were compared value by value; see `CHANGELOG.md` for what moved.

---

## 1. Three tiers

```
primitives  ──▶  roles  ──▶  component properties
raw ramps        semantic     per-component knobs
never themed     themed here  variants flip these
```

A component never reads a primitive. `.__NS__-button--primary` sets
`--__NS__-button-bg` from a role, so a theme setting can repaint every button by
moving the role — without touching a variant.

---

## 2. Using a token

```scss
@use 'utils' as u;
```

| Helper | Returns |
|--------|---------|
| `u.rem(16)` | `1rem` — accepts a list |
| `u.fluid(24, 40)` | `clamp()` between the 390px and 1400px artboards |
| `u.space('lg')` | `var(--__NS__-space-lg)` |
| `u.layout('page-margin')` | `var(--__NS__-layout-page-margin)` |
| `u.radius('pill')`, `u.shadow('card')` | shape and elevation |
| `u.color('blue.800')` | `var(--__NS__-color-blue-800)` — the primitive |
| `u.hex('blue.800')` | `#002639` — literal, for `rgba()` and gradients |
| `u.role('text-primary')` | `var(--__NS__-text-primary)` — what components use |
| `u.role-hex('text-primary')`, `u.channels('…')` | literal and `"0, 38, 57"` channels |
| `u.control('height-lg')`, `u.glass('fill')` | control sizing, glass surface values |
| `u.duration('base')`, `u.easing('out')`, `u.z('modal')` | motion and layering |
| `@include u.type('h2')` | family, weight, fluid size, leading, tracking, case |
| `@include u.min('md')` | mobile-first breakpoint |
| `@include u.surface-glass` | translucent fill + backdrop blur — overlays only |
| `@include u.transition(…)`, `@include u.focus-ring` | motion and keyboard focus |

Every accessor `@error`s on an unknown key, so a typo fails the build instead of
emitting `var(--__NS__-space-mdd)` and collapsing to zero.

**No raw `px`.** A literal ignores browser text size — 200% zoom leaves it at
16px, failing WCAG 1.4.4. Fixed values go through `u.rem()`, anything that should
scale through `u.fluid()`. Three exceptions: hairline `1px` borders, `--__NS__-radius-full: 999px`,
and media-query widths.

---

## 2b. Surfaces

Three grounds, each a flat fill one step lighter than the one behind it. A
section is a panel on the canvas; its cards are cards on that panel.

| Tier | Role | Value | Used by |
|------|------|-------|---------|
| Canvas | `background-canvas` | #F2EBE6 | `body`, and any section that sits directly on the page |
| Panel | `surface-panel` | #F7F3F1 | a section's `__panel` / `__inner` under its `--card` modifier |
| Card | `surface-card` | #FAF8F7 | a tile on a panel: `.__NS__-card`, `.__NS__-feature-card`, `.__NS__-faq__item`, `.__NS__-spec__cell`, `.__NS__-multi-column__column--card` |

Every tier is opaque, so none of them carry a backdrop blur: the filter would
snapshot a backdrop the fill already hides. `surface-glass` is reserved for the
overlays that float over content which moves under them — the header dropdown,
the cart drawer, and the blurred button fills.

## 3. Primitives

| Family | Stops |
|--------|-------|
| `neutral` | `base` #F2EBE6 · `white` #F8F7F2 · `panel` #F7F3F1 · `card` #FAF8F7 · `pure` #FFFFFF · `border` #E4DFD9 · `rule` #EADFD9 · `ink` #020202 · `muted` #546E7D · `grey-600` #615E5C · `subtle` #706965 · `disabled` #A69D98 |
| `blue` | `800` #002639 (primary) · `700` #0C3648 · `600` #174556 · `500` #4D6774 |
| `blush` | `base` #E8D5CD · `accent` #E8637A |
| `sage` | `base` #BFC5BD · `accent` #5E9B6F |
| `status` | `success` #5E9B6F · `warning` #E29A5B · `error` #E8637A · `info` #4F86A1 |

`grey-600` is the body-copy grey and `blue.500` the eyebrow, both taken from the
Figma variables the section frames bind to. They read as `text-copy` and
`text-eyebrow`; `text-subtle` stays the lighter grey for metadata. `text-copy`
clears the policy below at 5.5:1 on the canvas and 6.4:1 on white.

`blue.700` and `blue.600` are derived from the primary button's radial gradient
stops, which Figma gives as `rgba(23,69,86)` and `rgba(12,54,72)`. They are the
only values in the system not stated directly as swatches.

### Type

| Step | Family | Figma | Fluid |
|------|--------|-------|-------|
| `display-xl` | Plantin Regular | 64 | 40 → 64 |
| `display` | Plantin Light | 56 | 36 → 56 |
| `h1` | Plantin Light | 40 | 30 → 40 |
| `h2` | Plantin Regular | 32 | 26 → 32 |
| `h3` | Plantin Light | 24 | 20 → 24 |
| `h4` | Plantin Semibold | 20 | 18 → 20 |
| `body-l` | Geist Light | 20 | 18 → 20 |
| `body` | Geist Regular | 16 | fixed |
| `body-s` / `label` | Geist Light / Medium | 14 | fixed |
| `button` | Geist Medium | 18 | 16 → 18 |
| `caption` | Geist Light | 12 | fixed |
| `eyebrow` | Brandon Medium | 16 caps, +2px tracking | 14 → 16 |

Tracking is stored in `em` and leading unitless, so both follow the fluid size.
Eyebrow's 2px at 16px becomes `0.125em`.

#### Loading the faces

`snippets/__NS__-fonts.liquid` declares every `@font-face`, rendered from
`layout/theme.liquid` ahead of the Vite tags. The woff2 files live in
**Settings → Files**, not in `assets/`: same Shopify CDN, but they outlive a
theme swap and are shared by every theme on the store.

| Face | File in Settings → Files | State |
|------|--------------------------|-------|
| Geist Variable 100–900 | `__NS__-geist-variable.woff2` | **uploaded** — SIL OFL 1.1, from npm `geist@1.7.2` (`dist/fonts/geist-sans/Geist-Variable.woff2`) |
| Plantin MT Pro Light | `__NS__-plantin-light.woff2` | licensed — not yet supplied |
| Plantin MT Pro Light Italic | `__NS__-plantin-light-italic.woff2` | licensed — not yet supplied |
| Plantin MT Pro Semibold | `__NS__-plantin-semibold.woff2` | licensed — not yet supplied |
| Brandon Grotesque Medium | `__NS__-brandon-medium.woff2` | licensed — not yet supplied |

Each face is gated on its own `file_url`, so a name with nothing behind it leaves
the face undeclared and the step falls back (Georgia for editorial, system sans
for interface and eyebrow). Upload the woff2 to Files under that exact name and
the face starts rendering on the next page load — no code change.
One variable file covers Geist's 300 and 500 weights, and it is the only face
preloaded — the editorial faces are below the fold of first paint.

Horizon's own `snippets/fonts.liquid` still preloads the `font_picker` fonts
(currently Inter). Those preloads are inert: `base/_horizon-bridge.scss` re-points
`--font-body--family` and friends at the __NS_TITLE__ stacks, so nothing renders in them.

#### Corrected against the page frames

The Style Sheet's one-line specimens and the frames that use them disagreed on
three values. The frames and the components they instance win, because that is
what the pages are drawn with:

| Step | Specimen said | Figma style / component | Shipped |
|------|---------------|-------------------------|---------|
| `h2` | Plantin Light 30, leading 1.1 | "H2 (v SmalleR) Card Title" — Plantin Regular 32, leading 1 | **Regular 32 / 1** |
| `body` | Geist Light 16 | "Body Copy" — Geist Regular 16 | **Regular 16** |
| `button` + `control.height-lg` | Geist Medium 16 in a 60px pill | "Button Primary" component — Geist Medium 18 in a 51px pill | **18 in 48 → 51** |

Body keeps its 1.5 leading; "Body Copy" states 136%, which is a block-level
choice the marketing frames make, so sections that draw it set `line-height`
themselves rather than tightening every paragraph in the theme.

#### Decided in code, not in Figma

The Style Sheet is a single 1400px artboard of one-line specimens, so three
things have no design source and were settled here:

| Decision | Reasoning |
|----------|-----------|
| Mobile sizes (the `min` of every fluid step) | Figma gives desktop only; each step scales to a 390px artboard rather than stepping at a breakpoint |
| Leading | Specimens are single lines with leading collapsed. Headings take 1.02–1.2, body 1.5 |
| `body-s` at 14 | Figma stops at 16 for body; small print and card copy needed a step that is not `label` (medium weight) |
| `.__NS__-button--glass` | No Figma frame. It is the primary button's geometry in white, for dark and photographic backdrops |

### Contrast policy

Body text clears 4.5:1 and large text 3:1, verified against both the canvas
(#F2EBE6) and white, so one token works on every surface. Three results changed
the palette:

| Token | Figma | Shipped | On canvas |
|-------|-------|---------|-----------|
| `text-muted` | #5E7C8C | **#546E7D** | 3.76 → 4.56:1 |
| `status-*` as text | #5E9B6F #E29A5B #E8637A #4F86A1 | **`text-success` #477554, `text-warning` #9F591C, `text-error` #D01F3D, `text-info` #427187** | 1.98–3.39 → 4.5+:1 |
| interactive borders | #E4DFD9 (1.12:1) | **`border-strong` #8A8079** | 3.27:1 |
| inactive tab label | #797674 (3.83:1) | **`text-subtle` #706965** | 4.57:1 |

The bright status stops stay: they are fill colours for dots, pills and bars,
where 3:1 against the adjacent surface is the bar. Only text and icons take the
ink stops.

Two failures are deliberate. `text-disabled` sits at 2.26:1 because WCAG 1.4.3
exempts inactive controls and lifting it would read as available. `border-default`
at 1.12:1 is a decorative hairline, not a boundary that carries meaning; anything
a user acts on uses `border-strong`.

Focus is a two-tone ring: a dark outline with a light halo filling the offset gap.
A single dark ring scored 1.65:1 against the primary button's own fill, so it
disappeared exactly where it mattered. A dark section reassigns
`--__NS__-focus-ring` (see `.__NS__-scheme-dark`).

---

## 4. Components

| Component | Spec |
|-----------|------|
| `.__NS__-button--primary` | 51px tall (48 on mobile), pill, radial dark-blue wash at 82% over a 6px backdrop blur, inset highlight stack, 22×10 arrow |
| `.__NS__-button--glass` | Same geometry, white gradient — for dark or photographic backdrops |
| `.__NS__-button--secondary` | 36px, 18px radius, `blue.800` at 5% |
| `.__NS__-button--tertiary` | 44px, transparent, underline on hover, 70% on press |
| `.__NS__-panel` | `surface-panel`, 10px radius, `shadow('card')` |
| `.__NS__-card` | `surface-card`, 6px radius, 1px white border |
| `.__NS__-field` | 48px control, 12px radius, 1px `border-default`; hover `text-muted`, focus `text-primary`, error `text-error`, disabled on the canvas fill |
| `.__NS__-checkbox` | 24px square, 2px `border-strong`, ink fill and a white tick when checked |
| `.__NS__-faq__item` | `surface-card` question card, no radius, `shadow('card')`, 12×21 chevron rotated 90° closed / -90° open |
| `.__NS__-feature-card` | 500px min, 20px pad, 6px radius, `surface-card` with a 1px white hairline and `shadow('card')`, lifting to white on hover; 225px image window at 4px radius. One component behind both the blog grid and Featured collection |
| `.__NS__-pagination` | 48px pills, `radius('full')`; numbers are circles, current and Next carry `action-primary` |
| `.__NS__-cart-drawer__panel` | Right-hand `<dialog>`, `min(100%, 480px)`, `background-raised`, `shadow('raised')`; slides on `transform`, backdrop `blue.800` at 32% |
| `.__NS__-cart-line` | 88px media at 4px radius, stepper pill at `radius('full')`, caption-scale variant and discount lines |
| `.__NS__-cart-goal__track` | 6px `radius('full')` rail on `border-default`; the fill is `scaleX()`, never a tweened width |
| `.__NS__-spec__table` | Real `<table>`; `--rows` gaps 8px vertically so each row is a card, `--columns` gaps 20px horizontally so each column is. Cells are `surface-card` on a `surface-panel` sheet, with no blur on either — each ground is opaque over the last. Two columns become a table at `md`, three or more at `xl`; below that the rows stay a stack whose pairs flow into columns from `sm` |

`layout('page-margin')` is 20 → **44**, not 60: the header logo sits at 44 of
1440, the footer wordmark at 42, and every panel frame insets 39–40. The 60 was
a code-side guess from before those frames existed.

**A section panel runs to the page margin at every width, and nothing caps it at
the 1440 artboard.** Multi-column, media with text, rich text, the buy box and
the rest have always done this; the spec table, FAQ, blog grid, contact form and
featured post each carried a `max-width: 1360` left over from reading the frame
as a fixed canvas rather than the widest one drawn. Side by side above 1440 the
two behaviours read as a layout bug — half the page steps in, half does not. Cap
the measure inside a panel instead: `__body` at 305, `__intro` at 680, the text
column of media with text at 516.

`shadow('menu')` — 2px down, 12px blur, `neutral.border` — is Figma's "Menu
drop shadow", the flat lift under a panel that carries a card of its own.
Figma states it as opaque #E7E6DF; the palette's #E4DFD9 stands in.

The inset shadow stack on primary is the lighting, not decoration — remove it and
the button flattens to a navy capsule. All seven layers are Figma's, in Figma's
order, including the opaque `#999` rim and the `#f2f2f2` inner glow that carry
the bright edge. Softening either one is what made the button read flat.

Its wash is an ellipse, not a guess: `49.8% 334.5% at 83% 42.5%` is Figma's
`matrix(-9.8212 0.9 -0.6103 -20.072 163.3 25.5)` at radius 10, resolved against
the 197 x 60 pill. The earlier `120% 180%` spread the ellipse wide enough that
the dark outer stop never arrived, and the label fell to 4.45:1 before its last
glyph. Widen it again and the contrast goes with it.

> **Open: the cart drawer's full state.** Figma 40012291:16305 is a flattened
> screenshot of a stock Horizon demo store, not a __NS_TITLE__ design, so only the empty
> state's structure came from it — right-hand panel, centred bag with a count
> badge, heading, pill. Colour, type and the whole populated state are inferred
> from the system. Replace them when the real frames land.

> **Open: secondary button states.** Figma labels hover / pressed / disabled for
> "Secondary Neutral" in red and draws the white glass pill in those slots — a
> different component from the 36px default. Our secondary darkens its own fill
> (5% → 10% → 16%) until the designer resolves it.

---

## 5. Overriding Horizon

`layout/theme.liquid` renders Horizon's `stylesheets`, `theme-styles-variables`
and `color-palette` before our `vite-tag`, so at equal specificity we win on
source order.

**Never wrap __NS_TITLE__ CSS in `@layer`.** Unlayered declarations beat layered ones
regardless of order, and Horizon is entirely unlayered.

Three levers, in order of preference:

1. **Re-point Horizon's variables** — `base/_horizon-bridge.scss`. Horizon exposes
   ~224 custom properties; the bridge maps colour, type, radii, spacing, control
   sizing, focus and motion onto __NS_TITLE__ values. This repaints the base theme without
   touching a Horizon selector and survives an upgrade. First place to look when a
   stock component renders wrong.
2. **Neutralise what Horizon hardcodes** — `base/_horizon-suppress.scss`, matched
   specificity, no `!important`.
3. **Replace the markup** — a __NS_TITLE__ snippet renders __NS_TITLE__ classes and Horizon's
   selectors never match. The end state for buttons, inputs, cards.

`!important` is reserved for Horizon's inline `{% style %}` output and
Shopify-injected checkout styles. Each use carries a comment naming the rule it
fights. Anywhere else it is a bug in the bridge.

---

## 6. File layout

`utils/` is output-free — maps, functions, mixins only — so any partial can
`@use` it without duplicating a byte. `tokens/_emit.scss` is the single place
those maps become custom properties.

```
frontend/styles/
├── DESIGN.md
├── utils/        _unit _vw-calc _mq _colors _type _tokens  (+ _index barrel)
├── tokens/       _emit.scss          :root + reduced-motion
├── base/         _typography _horizon-bridge _horizon-suppress
└── components/   _button _card      snippet-level primitives
```

Section styles do not live here. One section is one folder under
`frontend/modules/sections/<name>/`, holding its `_<name>.scss` beside the
TypeScript that mounts it — delete the folder and the section is gone.

Import order in `entrypoints/custom_styling.scss` is load-bearing: tokens must
exist before anything reads them, and the bridge lands after them.

---

## 7. Styleguide

`sections/__NS__-styleguide.liquid` renders the live custom properties — swatches
read `var(--__NS__-color-*)`, spacing bars read `var(--__NS__-space-*)`, buttons are
real buttons. A regression in the token layer shows up here before production.

Gated on `settings.__NS___styleguide_enabled` (Theme settings → __NS_TITLE__ → Developer),
off by default.

---

## 8. Still to build

Badges, chips, toasts, modals, tabs, breadcrumbs and pagination have no Figma
frames in this file yet. Add the frame, then the component — not the other way
round.
