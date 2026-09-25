# Frontend Development Guide

## The tag is the initiator

A section mounts because its custom element appears in the DOM. The browser
upgrades the element while parsing, so there is no boot scan, no registry and no
`DOMContentLoaded` wait — and anything that inserts the markup later (theme
editor re-render, Section Rendering API, AJAX) mounts through the same path.

```liquid
<__NS__-carousel data-config="{{ config | escape }}">
  <button type="button" class="__NS__-carousel__next" data-ref="next">Next</button>
</__NS__-carousel>
```

```typescript
// frontend/modules/sections/carousel/carousel.ts
import { __NS_TITLE__Element } from '@/core';
import { defineElement } from '@/utils';
import type { CarouselConfig } from './carousel.types';

const DEFAULT_CONFIG: CarouselConfig = { autoplay: false, speed: 300 };

export class Carousel extends __NS_TITLE__Element {
  private config: CarouselConfig = DEFAULT_CONFIG;

  protected mounted(): void {
    this.config = this.readConfig(DEFAULT_CONFIG);

    const _next = this.ref('next');
    if (!_next) return;

    this.on(_next, 'click', () => this.advance());
  }

  protected unmounted(): void {
    // Only for things on() does not cover: timers, observers, subscriptions.
  }
}

defineElement('__NS__-carousel', Carousel);
```

The tag keeps the `__NS__-` prefix; the folder, the file and the class drop it —
inside `frontend/modules/` the folder already says what a file is.

Wiring is two lines, and both fail silently when forgotten. The section barrel
imports the module for its side effect:

```typescript
// frontend/modules/sections/index.ts
import './carousel';
```

and the styles entrypoint picks up the partial:

```scss
// frontend/entrypoints/custom_styling.scss
@use '../modules/sections/carousel/carousel';
```

### What __NS_TITLE__Element gives you

| Member | Purpose |
|--------|---------|
| `mounted()` | Required. Runs on connect, once per connection. |
| `unmounted()` | Optional. Runs on disconnect, after listeners are torn down. |
| `on(target, type, handler)` | Listener bound to an AbortController that aborts on disconnect. |
| `ref(name)` / `refAll(name)` | `[data-ref="name"]` lookups inside the element. |
| `readConfig(defaults)` | Parses `data-config` JSON, falling back on bad input. |
| `log(message, data)` | `consoleMessage()` prefixed with the tag name. |

Hooks are `data-ref`, not Horizon's `ref`: Horizon's own `Component` collects
every descendant `ref` without a nearer `Component` ancestor, so plain `ref`
attributes inside our elements would end up in its refs object.

### Rules

- **MUST** name the tag with the project prefix — `__NS__-carousel`. The hyphen is
  required by the spec, and the prefix rules out collisions with Horizon tags.
- **MUST** register through `defineElement()`, which no-ops if the tag exists.
  The bundle can be evaluated twice in the theme editor.
- **MUST** give every custom element `display: block` (or flex/grid) in SCSS.
  Custom elements are `display: inline` by default.
- **MUST** add listeners with `this.on()`. Anything added directly must be
  removed in `unmounted()`.
- **MUST** treat the tag as the gate. Nothing runs until the element is in the
  DOM, and `mounted()` opens with guard clauses that bail *before* a listener,
  observer or timer exists — a slideshow with one slide returns on line one.
- **MUST NOT** assume `disconnectedCallback` means removal — it also fires when
  an element is *moved*. `__NS_TITLE__Element` handles the remount for you.
- **SHOULD** put a section's config type in a `.types.ts` companion next to the
  component, imported with `import type`.
- **SHOULD** reserve custom elements for things with their own lifecycle or
  state. Dumb markup stays a `data-ref` hook — upgrading one element per card in
  a long product grid is a real cost.

### Eager or lazy

The entrypoint is the whole page cost: everything it imports ships on every page.

```typescript
import './example';                                                  // eager
defineLazy('__NS__-carousel', () => import('@/sections/carousel'));    // own chunk
```

A lazily loaded module must **not** also appear in the barrel — a static import
pulls its dependency into the main bundle, which is exactly what the dynamic
import exists to prevent.

`defineLazy` loads the chunk when a tag nears the viewport, re-scanning on
`shopify:section:load` for the editor. Use it for sections carrying real weight —
a carousel, a video player, anything pulling a library. For a component measured
in hundreds of bytes the extra request costs more than the code it defers, so
import it eagerly.

The bundle is one file with no dynamic imports today, which is why
`build.modulePreload.polyfill` is off: nothing renders `<link rel="modulepreload">`,
and the polyfill would put a document-wide MutationObserver on every page. If a
future entrypoint needs preload hints, turn it back on in `vite.config.js`.

---

## Media and loading priority

Every image goes through `snippets/__NS__-image.liquid`, and every call passes
`section_index: section.index`.

```liquid
{%- render '__NS__-image',
  image: section.settings.image,
  mobile_image: section.settings.image_mobile,
  sizes: '100vw',
  section_index: section.index
-%}
```

`section.index` is 1 for the first section in the template. That section holds
the LCP candidate, so its image loads `eager` at `fetchpriority="high"`, and
everything below it is `lazy` and `low`. No other file sets those attributes by
hand. Pass `priority: 'high'` or `'low'` only when a section knows something its
position does not — a carousel slide that is offscreen sideways, for instance.

Art direction is a `<picture>` source, never a second `<img>`: a hidden image
still downloads, so CSS-swapped art costs the visitor both files.

Background video is `<__NS__-media>`, with the poster rendered inside it:

```liquid
<__NS__-media data-config="{{ video_config | escape }}">
  {%- render '__NS__-image', image: poster, section_index: section.index -%}
</__NS__-media>
```

The `<video>` is built in JavaScript because `media` on a `<source>` is ignored:
markup can only ever offer one file. The element picks the one for the current
breakpoint, plays it only while it is on screen, and under reduced motion never
builds it at all — the poster is then the whole experience.

---

## Motion

One animation dependency, and only one: `motion`, used by `<__NS__-reveal>` for
entrance staggers. Everything else is a CSS transition on `transform` and
`opacity`. Do not add a second library, and do not reach for Motion in a
component that a transition can do.

`<__NS__-reveal>` wraps a group and staggers whatever inside it opts in:

```liquid
<__NS__-reveal data-trigger="view">
  {%- render '__NS__-heading', text: heading, size: 'display-xl', animation: 'rise' -%}
  <p data-reveal>Body copy follows the heading in.</p>
</__NS__-reveal>
```

- Children opt in with `data-reveal`; DOM order is the stagger order.
- `data-trigger="load"` skips the intersection wait. Use it for the first
  section on a page — an observer round trip delays the LCP paint.
- Nothing in CSS hides revealed content. `<__NS__-reveal>` applies Motion's
  entrance as inline styles and removes them when it finishes, so a failed
  bundle, a hidden tab or the theme editor always leaves the section visible.
- `snippets/__NS__-heading.liquid` splits copy into words so it can rise a word at
  a time, keeping the line breaks the merchant typed.

---

## Theme editor

Every editor event that re-renders the section HTML is already handled: the old
element is discarded (`disconnectedCallback`) and the new one mounts
(`connectedCallback`). That covers section load, unload and every settings change.

`shopify:block:select` and `shopify:block:deselect` are the exceptions — they fire
without a DOM swap. They bubble from the block, so the element listens on itself:

```typescript
this.on(this, 'shopify:block:select', (event) => {
  (event.target as HTMLElement)?.scrollIntoView({ block: 'nearest' });
});
```

---

## File layout

`@` points at `frontend/modules/`. One folder per thing the theme renders:
deleting the folder deletes the section, with no orphaned partial three
directories away.

| Type | Location |
|------|----------|
| Section module | `frontend/modules/sections/<name>/<name>.ts` |
| Section types | `frontend/modules/sections/<name>/<name>.types.ts` |
| Section styles | `frontend/modules/sections/<name>/_<name>.scss` |
| Section barrel | `frontend/modules/sections/index.ts` |
| Shared element behaviour | `frontend/modules/elements/<name>/` |
| Base class and global store | `frontend/modules/core/` |
| Utilities / constants / shared types | `frontend/modules/utils/`, `constants/`, `types/` |
| Design system and snippet primitives | `frontend/styles/` |

`frontend/ARCHITECTURE.md` carries the full rationale — why elements build
sections, why barrels use side-effect imports, and what stays in `styles/`.

`@/core` is imported before any component module, because registering a tag
upgrades elements already in the document and they mount synchronously — a
component that reads `window.__NS__` at mount would otherwise find it undefined.
Importing the barrel is what assigns it.

---

## Styling (SCSS)

`frontend/styles/DESIGN.md` is the reference — tokens, component specs, and how
the layer overrides Horizon. The short version:

```scss
@use 'utils' as u;
```

| Helper | Use |
|--------|-----|
| `u.rem(16)` | px to rem. Lists work: `u.rem(16 24)`. |
| `u.fluid(24, 40)` | Scales between the 390px and 1400px artboards, clamped. |
| `u.space('lg')`, `u.layout('page-margin')` | Spacing and layout tokens. |
| `u.radius('pill')`, `u.shadow('card')`, `u.control('height-lg')` | Shape, elevation, control sizing. |
| `u.role('text-primary')` | Semantic colour — what components use. |
| `u.color('blue.800')` / `u.hex('blue.800')` | Primitive as a variable / as a literal for `rgba()`. |
| `u.duration('base')`, `u.easing('out')`, `u.z('modal')` | Motion and layering. |
| `@include u.type('h2')` | Family, weight, fluid size, leading, tracking, case. |
| `@include u.min('md')` | Mobile-first breakpoint. Also `u.max()`, `u.between()`. |
| `@include u.surface-glass` | Translucent fill + backdrop blur, with fallback. |
| `@include u.transition(…)`, `@include u.focus-ring` | Motion, keyboard focus. |

```scss
@use 'utils' as u;

__NS__-carousel {
  display: block;
  padding: u.space('xl') u.layout('page-margin');
  color: u.role('text-primary');
}

.__NS__-carousel__heading {
  @include u.type('h2');

  margin-bottom: u.space('sm');
}

@include u.min('md') {
  __NS__-carousel {
    padding: u.space('2xl') u.layout('page-margin');
  }
}
```

### Rules

- **MUST NOT** write raw `px`. `u.rem()` for fixed sizes, `u.fluid()` for anything
  that scales. Exceptions: hairline `1px` borders, `--__NS__-radius-full`, and media
  query widths.
- **MUST** read colour through `u.role()`. A component that names a primitive
  cannot be re-themed.
- **MUST NOT** add a new literal where a token exists. A value two sections share
  belongs in `utils/_tokens.scss`, and only `tokens/_emit.scss` writes `:root`.
- **MUST** stay mobile-first: base styles are the phone, `@include u.min()` adds.
- To change how stock Horizon looks, re-point its variable in
  `base/_horizon-bridge.scss` — do not override Horizon selectors, and never wrap
  __NS_TITLE__ CSS in `@layer` (unlayered always wins, and Horizon is unlayered).

### BEM Naming

```scss
.product-card {           /* Block */
  &__image { }            /* Element */
  &__title { }
  &__price { }
  &--featured { }         /* Modifier */
  &.is-loading { }        /* State */
}
```

---

## Pre-Flight Checklist

Before committing:

- [ ] Component extends `__NS_TITLE__Element` and registers with `defineElement()`
- [ ] Tag is `__NS__-` prefixed and styled `display: block`; folder, file and class
      are not
- [ ] Module is in the section barrel and its partial in `custom_styling.scss`
- [ ] Listeners added with `this.on()`; anything else released in `unmounted()`
- [ ] Config type lives in the `.types.ts` companion
- [ ] Guard clauses used for early returns
- [ ] Variables prefixed with `_` (function scope)
- [ ] Logging uses `consoleMessage()` or `this.log()`
- [ ] Mobile-first styles
- [ ] Under 500 lines
- [ ] Tested in Theme Editor (settings change, block select/deselect)
