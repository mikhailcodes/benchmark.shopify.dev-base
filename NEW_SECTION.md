# Building a new section

> Examples use `tm-` as the tag prefix and neutral token names.
> Substitute your project's prefix and design-system roles.

The working method for turning a Figma frame into a section in this theme.
[ARCHITECTURE.md](ARCHITECTURE.md) says where files go; this says how to build
the thing that goes in them.

Read your project's `DESIGN.md` before the first line of SCSS. It is the token
contract, and every accessor below errors on a key it does not know.

---

## 1. Mental model: sections are islands

Borrow Astro's framing. **The page is static HTML that Shopify renders. A
section is an island of interactivity inside it.**

That has consequences worth stating plainly, because they decide most of the
design questions further down:

- **The server renders the content. Always.** Liquid produces the final markup —
  every heading, every card, every image. JavaScript never fetches what Liquid
  could have printed.
- **An island hydrates itself.** The custom element tag in the markup is the
  hydration trigger. No registry, no boot loop, no `querySelectorAll` sweep.
- **Islands are independent.** One section's JavaScript failing must not affect
  another's. No shared mutable globals; cross-section talk goes through store
  events.
- **The island is optional.** Kill JavaScript entirely and the section must still
  be readable and usable. Behaviour enhances; it does not deliver.

The test: disable JavaScript, reload, and check the section still communicates
what it is for. If it collapses, the work went in the wrong layer.

---

## 2. Read the design properly

```
/figma-design-to-code                      load the skill first — it is mandatory
get_design_context(fileKey, nodeId)        reference code + screenshot + tokens
get_variable_defs(fileKey, nodeId)         bound variables, when the frame has them
```

`get_design_context` returns **React and Tailwind**. It is a measurement
report, not code to port. Read the numbers out of it and throw the JSX away.

Record the node id in a comment at the top of the Liquid file. A section whose
design source is unnamed cannot be re-checked six months later.

### Map every value to a token before writing anything

Go property by property and translate:

| Figma | Becomes |
|-------|---------|
| `bg-[#f4e4ee]` | `u.role('surface-accent')` |
| `text-[#1c1c1c]` | `u.role('text-primary')` |
| `gap-[48px]` | `u.space(48)` |
| `rounded-[44px]` | `u.radius('pill')` |
| `text-[20px]` Prompt Medium | `@include u.type('feature-title')` |

**When there is no token, stop and decide deliberately.** Three options, in
order of preference:

1. **The nearest token is right** and Figma drifted — use it, note it.
2. **The design is right** and the scale is short — add the key to
   `styles/utils/_type.scss` (or the relevant map) with a comment naming the
   node it came from, and update DESIGN.md.
3. **It is genuinely one-off** — a local `u.rem()` / `u.fluid()` value in the
   section's own partial.

What you must not do is approximate silently — and the bar for option 2 is that
**no existing step can do the job**, not that Figma reports a different number.
The benefit row added `section-title` (nothing sat between `h1` at 44 and
`numeral` at 56) and `feature-title` (no ui step at 20 existed at all). A third
candidate, a 16 / 24 caption, was rejected: it differed from `body` by
line-height alone, so it used `body`.

Check the frames against each other before adding anything. Two sections drawing
the same role at 48 Bold and 46.1 Regular is a Figma inconsistency to raise, not
two tokens to create.

### Before building: is this one section or two?

Frames that look different are often one section with different fields filled
in. Check before writing anything, because merging two frames after the fact
means rewriting both.

**Put them side by side and diff the container**, not the contents:

| | A `581:36288` | B `581:36421` |
|---|---|---|
| Intro | none | heading + description |
| Columns | 2 | 2 |
| Image | 650×650 — 1:1 | 643×822 — 4:5 |
| Radius | 30px | 10px |
| Gap | 20px | 35px |
| Padding | px 60 / py 40 | px 60 / py 40 |
| Card body | none | eyebrow · title · body · rule · stats |

Same container, same columns, same padding. A **is** B with the intro and card
bodies empty. One section, two presets.

The reading to internalise: **an empty field is a layout variant.** Guard every
optional field with `!= blank` and a frame with no heading is not a different
section, it is the same section with no heading. That is also why defaults
matter — a preset per frame gives merchants both looks without a second file.

What the diff *does* tell you is which values must become settings. Here, three
properties differed — ratio, radius, gap — so all three are settings rather than
hardcoded values. Anything identical across frames stays in the stylesheet.

A caution: only merge when the **container** matches. Two frames that share a
card style but differ in layout (a grid versus a carousel) are two sections that
should share a snippet, not one section with a mode switch.

### Reusing type steps: the 4px rule

Reuse the nearest existing step when it is **within 4px**. Add a token only
past that, or when size is close but the step is wrong in a way that breaks
hierarchy.

Worked example, from the two frames above:

| Figma | Nearest step | Verdict |
|-------|--------------|---------|
| Heading 50 / 70 SemiBold | `h1` 44 | reuse — 6px, but the same role is drawn 46–50 across three frames |
| Card title 40 / 50 SemiBold | `h1` 44 | reuse — 4px, same family and weight |
| Stat number 29 Medium | `h3` 28 | reuse — 1px |
| Body 17.9 / 26.88 | `lead` 18 | reuse — line-height only |
| Eyebrow 11 Bold, 2.5px tracking | `eyebrow` 11 | reuse |

Five candidate tokens, none added.

**Weight is the tiebreak size cannot settle.** A 20px Medium card title has
`lead` 2px away — inside the rule — but `lead` is 400, which would leave a title
and its caption at the same weight and erase the hierarchy. No 500-weight step
exists above 14px, so that one earns a token. The question is never "does the
number match", it is "can an existing step do this job".

**When frames disagree, that is a Figma bug, not a token.** The band heading is
drawn Bold 48/58, Regular 46.1/58.93 and SemiBold 50/70 in three different
frames. Emit one step, use it everywhere, and raise the inconsistency — three
tokens would encode the mistake permanently.

### Accessibility overrides fidelity

Your design system's contrast table records where Figma's colour fails and what
replaces it. Check it before taking a colour from a frame.

A real example: a 13px accent label measured 4.07:1 on its tinted ground, below
the 4.5:1 floor, so it renders in a darkened derivative at 5.83:1 instead.
Reproducing a contrast failure faithfully is still a contrast failure — record
the substitution rather than silently matching Figma.

---

## 3. Settings and blocks

**Settings are for what the merchant changes. Blocks are for what they repeat.**

If a section shows five of something, that is five blocks, not five pairs of
settings. Blocks give reordering, add and remove, and per-item theme-editor
selection for free.

```json
{
  "name": "Benefit row",
  "tag": "section",
  "class": "tm-benefit-row",
  "max_blocks": 6,
  "settings": [ ... ],
  "blocks": [ { "type": "benefit", "name": "Benefit", "settings": [ ... ] } ],
  "presets": [ { "name": "Benefit row", "blocks": [ ... ] } ]
}
```

Rules that keep sections merchant-proof:

- **`tag` and `class` in the schema**, so the section root is the semantic
  element and carries the block class. Do not wrap the whole section in an extra
  `<div>` to get a hook. (`tag: null` is valid for *blocks* only — a section
  schema rejects it.)
- **Every block prints `{{ block.shopify_attributes }}`.** Without it the theme
  editor cannot highlight or select the block.
- **A preset that matches the design.** A merchant adding the section should get
  the Figma content, not five empty slots.
- **Defaults are real copy**, taken from the frame.
- **Guard every optional field** with `{%- if x != blank -%}`. Empty settings are
  normal, and a lone bullet or stray gap is the tell that they were not handled.
- **Expose only what the design supports.** A colour picker on a section whose
  palette is fixed by the design system is a support ticket waiting to happen.
- **`max_blocks`** wherever the layout breaks past a count.

### Config that JavaScript needs

```liquid
<tm-reveal class="…" data-config="{{ section.settings | json | escape }}">
```

`parseElementConfig()` merges that over the element's defaults and warns on
malformed JSON. Config type keys mirror the schema setting ids, so they stay
`snake_case`.

---

## 4. Performance

Shopify's own guidance, applied:
[theme performance](https://shopify.dev/docs/storefronts/themes/best-practices/performance),
[lazy loading](https://shopify.dev/docs/storefronts/themes/best-practices/performance/lazy-loading),
[Web Performance (Shopify Engineering)](https://shopify.engineering/topics/performance).

### Images

Shopify's CDN handles format negotiation, resizing and delivery. Never a
build-time image pipeline, never a JavaScript lazy-loader.

```liquid
{{ image | image_url: width: 1500 | image_tag:
   loading: 'lazy', widths: '400,600,800,1200,1500', sizes: '(min-width: 768px) 50vw, 100vw' }}
```

Always set `width` and `height` (or an aspect-ratio box) — an image without
intrinsic dimensions is a CLS bug that only shows up on a slow connection.

### Above vs below the fold

`section.index` tells a section where it sits in the template. Use it to decide
loading priority instead of hardcoding:

```liquid
{%- liquid
  assign loading = 'lazy'
  assign priority = 'auto'

  if section.index == 1
    assign loading = 'eager'
    assign priority = 'high'
  endif
-%}

{{ image | image_tag: loading: loading, fetchpriority: priority }}
```

(Liquid has no ternary operator — assign the value in a `liquid` block and pass
the variable.)

One eager image per page — the LCP candidate. Everything else is lazy. A hero
marked `eager` plus four more eager images below it means five images competing
for the connection the LCP needed.

The same idea governs JavaScript: below-the-fold behaviour goes behind
`whenVisible()`, which returns a teardown that `disconnectedCallback()` must
call.

### JavaScript budget

The entry bundle does one thing: define tags. Nothing queries the DOM, fetches,
or runs until an element is on the page.

```ts
// Heavy dependency — only pages carrying the tag pay for it.
const { createCarousel } = await import('@/elements/carousel/carousel');
```

Anything with a real dependency (Embla, a date library, a player) is dynamically
imported inside `connectedCallback()`. Vite splits the chunk automatically. A
plain module like this must never be re-exported from an eager barrel — a static
import drags it back into the main bundle and undoes the split.

### The rest

- Cache element references once on init. Never `querySelector` inside a handler —
  delegate from the section root and use `closest()`.
- Layout reads (`getBoundingClientRect`, `offsetWidth`) belong in a
  `requestAnimationFrame`, never in an unthrottled scroll or resize handler.
- One `AbortController` per element beats one listener per child.
- `content-visibility: auto` with a `contain-intrinsic-size` on tall
  below-the-fold sections lets the browser skip rendering work entirely.

---

## 5. Animation

**The default is CSS. No animation library ships to the browser.**

Transitions and keyframes run on the compositor; a JavaScript library runs on the
main thread and competes with everything else on the page. The budget for a
theme this size does not have room for the second thing.

### The three tiers

| Tier | Use | Cost |
|------|-----|------|
| CSS transition + keyframes | ~95% of section work | 0 KB |
| Web Animations API (`element.animate()`) | sequencing that CSS cannot express | 0 KB, native |
| A library (Motion One, ~4 KB) | spring physics, FLIP, scroll-linked timelines | dynamic import only |

Reach for tier 3 only when tiers 1 and 2 have actually failed, and load it the
same way as any other heavy dependency — `await import()` inside
`connectedCallback()`, never in the entry bundle.

### Entrance animations use `<tm-reveal>`

Do not hand-roll an IntersectionObserver per section. The shared element takes over a
group, hands the cascade an index per item, and the CSS does the rest:

```liquid
<tm-reveal class="tm-benefit-row__items" data-config="{{ section.settings | json | escape }}">
  <div class="tm-benefit-row__item" data-reveal-item>…</div>
</tm-reveal>
```

```scss
.tm-reveal.is-loaded > * {
  opacity: 0;
  transform: translate3d(0, u.rem(16), 0);
  transition:
    opacity u.transition('slow') u.easing('out'),
    transform u.transition('slow') u.easing('out');
  transition-delay: calc(var(--tm-reveal-index, 0) * var(--tm-reveal-stagger, 0ms));
}
```

Why it is shaped this way:

- **`is-loaded` is set by script, never by Liquid.** The hidden state only exists
  once JavaScript is present, so no-JS and failed-chunk both render the content
  normally. Hiding content in CSS and revealing it in JS is how sections end up
  permanently invisible.
- **The stagger is a custom property**, so delay is cascade arithmetic rather
  than a timer per item.
- **`will-change` is dropped after landing.** A permanent hint costs a
  compositor layer per item for an animation that runs once.

### Rules

- Animate `transform` and `opacity`. Nothing else. `width`, `height`, `top` and
  `left` trigger layout on every frame.
- Honour `prefers-reduced-motion: reduce` — final state, no transition. The
  reveal element skips observing entirely in that case.
- Durations and easings come from tokens: `u.transition('base')`,
  `u.easing('out')`. The spring curve is `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- Stagger ~80ms. Long enough to read as a sequence, short enough that the last
  item is not still waiting when the group has been read.
- Never animate an element into view that the user has already scrolled past.

---

## 6. Writing the CSS

Mobile-first, BEM, tokens only.

```scss
@use '../../../styles/utils' as u;

.tm-thing {
  display: block;                       // custom elements are inline by default
  padding-block: u.space(48);

  @include u.min('md') { padding-block: u.space(80); }
}

.tm-thing__item { }
.tm-thing--boxed { }
.tm-thing.is-open { }
```

- **No raw px.** `u.rem()`, `u.fluid()`, `u.space()` — the three sanctioned
  exceptions are in DESIGN.md §2.1.
- **No hex.** `u.role()` for semantic intent, `u.color()` only when no role fits.
- **`@include u.min()` only.** A `max-width` query means the mobile styles were
  written second.
- **State classes are `is-`.** Never bare `.active` or `.open`.
- **`:focus-visible` on everything interactive**, via `u.focus-ring` or
  `u.focus-ring-inline`.

---

## 7. Desktop vs mobile

**Figma gives you a 1440 desktop artboard and nothing else.** Every responsive
decision is therefore inferred — say so in a comment at the top of the partial,
so the next person knows it was a judgement call and not a spec.

How to infer well:

- **Count what fits.** Five 88px circles cannot share a phone row. The benefit
  row steps 2 → 3 → 5, and that reasoning is written in the file.
- **Reflow, do not shrink.** Scaling a desktop layout down produces 11px type.
  Change the column count, the direction, the order.
- **Some things must not restack.** A comparison table stops being a comparison
  when it becomes five stacked lists — scroll it horizontally in an
  `overflow-x: auto` wrapper instead.
- **Touch targets are 44px.** `u.control('touch-target')`. Draw smaller if the
  design demands it, then grow the hit area with a transparent `::after`.
- **Padding shrinks first.** An 80px desktop band is usually 40–48px on a phone.
- **Type has a floor.** The fluid scale interpolates between 390 and 1080; check
  the small end, because body copy below 15px is not readable.
- **The page must never scroll horizontally.** Wide content scrolls inside its
  own container.

---

## 8. Checklist

Design
- [ ] Node id recorded in a comment at the top of the Liquid
- [ ] Every colour, space, radius and type step mapped to a token
- [ ] Missing tokens added deliberately and recorded in DESIGN.md
- [ ] Contrast checked against DESIGN.md §6

Markup
- [ ] Schema has `tag`, `class`, settings, blocks, preset with real copy
- [ ] `{{ block.shopify_attributes }}` on every block
- [ ] Optional fields guarded with `!= blank`
- [ ] Headings are a sane document outline, not styling choices

Performance
- [ ] Images via `image_url` / `image_tag`, with dimensions
- [ ] One eager image per page, chosen with `section.index`
- [ ] Heavy dependencies dynamically imported
- [ ] Below-the-fold behaviour behind `whenVisible()`, teardown called

Behaviour
- [ ] Works fully with JavaScript disabled
- [ ] `connectedCallback` / `disconnectedCallback` both present
- [ ] Listeners take `{ signal }`; handlers are arrow-function class fields
- [ ] Logging through `consoleMessage()`

Style
- [ ] Mobile-first, no raw px, no hex, BEM plus `is-` state classes
- [ ] `:focus-visible` on interactive elements
- [ ] `prefers-reduced-motion` honoured
- [ ] Responsive inference noted in a comment

Wiring — the two that fail silently
- [ ] `import './<name>';` in the barrel, or the tag never registers
- [ ] `@use` line in `custom_styling.scss`, or the styles never ship

Verify
- [ ] `yarn type-check` and `yarn lint`
- [ ] Renders on the dev server, and in the theme editor including block select
- [ ] `shopify theme check` still matches the recorded baseline
