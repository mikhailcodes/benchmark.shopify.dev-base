# __NS__ - Project Rules

## Project Overview

Shopify theme development project. Custom elements mount themselves: the tag in
the Liquid is the initiator, so there is no section registry and no boot scan.

- **Styling**: SCSS
- **JavaScript**: TypeScript
- **Package Manager**: yarn
- **Build**: Vite + vite-plugin-shopify

---

## Critical Rules

### Build Commands
- **MUST NOT** run `yarn run build` unless explicitly requested
- **MUST NOT** run `shopify theme push` unless explicitly requested

### Code Style

#### Naming Conventions
- **MUST** prefix function-scoped variables with underscore: `_element`, `_data`
- **MUST** use PascalCase for classes: `FeaturedCollection`, `ProductCard`
- **MUST** use camelCase for functions: `handleClick`, `initializeApp`
- **MUST** use UPPER_SNAKE_CASE for constants: `BREAKPOINTS`, `ANIMATION`

#### Early Returns
- **MUST** use guard clauses at the start of functions
- **MUST NOT** nest conditions more than 2 levels deep

```typescript
// Correct: Guard clauses first
_handleClick(event) {
  const _target = event.target;

  if (!_target) return;
  if (!_target.dataset.productId) return;
  if (this._isLoading) return;

  // Main logic here
  this._loadProduct(_target.dataset.productId);
}

// Wrong: Nested conditions
_handleClick(event) {
  if (event.target) {
    if (event.target.dataset.productId) {
      if (!this._isLoading) {
        // Too nested
      }
    }
  }
}
```

### Logging
- **MUST** use `consoleMessage()` utility, never `console.log` directly
- Logging respects `window.__NS__.settings.devMode`

### Custom Elements
- **MUST** extend `__NS_TITLE__Element` and register with `defineElement()` at the bottom
  of the component file, and add it to `modules/sections/index.ts` — see
  `frontend/CLAUDE.md` for the full pattern
- **MUST** name tags with the `__NS__-` prefix, and style them `display: block`
- **MUST** add listeners with `this.on()` so teardown cannot drift out of sync
- **MUST** open `mounted()` with guard clauses that return before any listener,
  observer or timer is created. The tag is the gate; the guards are the second
  gate
- **MUST NOT** reintroduce a registry or `data-section-type` mount path

### State Classes
- Use `.is-active`, `.is-loading`, `.is-hidden`, `.is-open`
- Never use `.active`, `.loading`, `.hidden` (too generic)

---

## File Locations

| Type | Location |
|------|----------|
| Layout rationale | `frontend/ARCHITECTURE.md` |
| Section module (ts, types, scss, barrel) | `frontend/modules/sections/<name>/` |
| Section barrel | `frontend/modules/sections/index.ts` |
| Shared element behaviour | `frontend/modules/elements/<name>/` |
| Base element class | `frontend/modules/core/element.ts` |
| Global store object | `frontend/modules/core/globals.ts` |
| Utilities (incl. `defineElement`) | `frontend/modules/utils/` |
| Constants | `frontend/modules/constants/` |
| Cross-module types | `frontend/modules/types/` |
| Design system reference | `frontend/styles/DESIGN.md` |
| SCSS helpers and tokens | `frontend/styles/utils/` |
| Token emission (`:root`) | `frontend/styles/tokens/_emit.scss` |
| Horizon bridge and suppression | `frontend/styles/base/` |
| Snippet-level component styles | `frontend/styles/components/` |
| SCSS load order | `frontend/entrypoints/custom_styling.scss` |

`@` resolves to `frontend/modules/`. The tag carries the `__NS__-` prefix; folders,
files and classes inside `frontend/modules/` do not.

---

## Global Object

Access via `window.__NS__`:

```typescript
window.__NS__.settings.devMode  // boolean — driven by the `__NS___dev_mode` theme setting
window.__NS__.theme.currency    // string
window.__NS__.routes.cartAdd    // string — Liquid routes, never hardcode /cart/add
window.__NS__.cart.count        // number — seeded from Liquid at first paint
window.__NS__.events            // EventTarget
```

Values come from `snippets/__NS__-theme-settings.liquid`, which renders before the
bundle. Anything Liquid knows and JavaScript needs belongs in that snippet.

---

## Events

Dispatch events via:
```typescript
import { dispatchStoreEvent } from '@/utils';

dispatchStoreEvent('cart:updated', { count: 5 });
```

Subscribe to events:
```typescript
import { subscribeToStoreEvent } from '@/utils';

const unsubscribe = subscribeToStoreEvent('cart:updated', (event) => {
  console.log(event.detail.count);
});

// Later: unsubscribe();
```

---

## The namespace rule

Every custom Liquid file carries the `__NS__-` prefix:

| Kind | Path |
|------|------|
| Sections | `sections/__NS__-*.liquid` |
| Snippets | `snippets/__NS__-*.liquid` |
| Blocks | `blocks/__NS__-*.liquid` |

A base-theme upgrade is then: overwrite every file without the prefix, and
whatever survives is ours. Unprefixed files belong to Horizon.

**Core theme files get additive edits only, and each one is a debt.**

| File | Change | Why unavoidable |
|------|--------|-----------------|
| `layout/theme.liquid` | Renders `__NS__-theme-settings` and the two `vite-tag` calls in `<head>`; swaps Horizon's `cart-drawer` render for the `cart-group` section group and seeds `data-ajax-cart-initial-state` | No extension point for `<head>`, and the drawer has to replace Horizon's at the same position |
| `config/settings_schema.json` | Appends the `__NS_TITLE__` settings group at the end | Global settings have no other home |
| `snippets/scripts.liquid` | Drops `product-form`, `sticky-add-to-cart`, `fly-to-cart` and the standard-actions override. `cart-discount` stays — it drives the `/cart` page, which is still Horizon's | Two libraries on one submit is a double add. Liquid Ajax Cart owns the cart |
| `blocks/buy-buttons.liquid` | Wraps the product form in `<ajax-cart-product-form>` | The wrapper has to be the form's parent; there is no hook around a `form` tag |
| `snippets/quick-add.liquid` | Same wrapper | Same |
| `sections/product-information.liquid` | Wraps the sticky bar in `<__NS__-sticky-buy>`, and its button becomes a real submit | `sticky-add-to-cart.js` owned both visibility and its own add-to-cart; only the first is wanted |

Three stock files are **deleted** rather than edited, because each one loads a
Horizon cart script the boundary guard forbids:

| File | Why |
|------|-----|
| `snippets/cart-drawer.liquid` | Loads `cart-drawer.js` and carries `id="cart-drawer"`; `sections/__NS__-cart-drawer.liquid` replaces it |
| `sections/cart-drawer-section.liquid` | Its only job was rendering that snippet for the Section Rendering API |
| `sections/quick-order-list.liquid` | Loads `quick-order-list.js`, which binds its own add-to-cart. Restore it only alongside a Liquid Ajax Cart wrapper for every form inside |

The cart row is the expensive one: four extra files, all of them on the
add-to-cart path. Re-apply it after a Horizon upgrade before anything else —
a missed wrapper is a silent fall-through to a full page navigation.

Before editing any other core file, try a theme setting, a section, a block, or a
metafield first. Those survive an upgrade untouched.

### Baselines

- Base theme: **Horizon __HORIZON_VERSION__**, seeded from `Shopify/horizon@__HORIZON_SHA__` (main). The baseline commit is unmodified, so `git diff` against it is
  exactly the __NS_TITLE__ layer.
- `shopify theme check`: __THEME_CHECK_BASELINE__ Pre-existing offences in
  stock Horizon files are not ours to fix; compare against this number rather
  than aiming for zero.
- Design tokens are **placeholders**: the palette, type scale and glass surfaces
  came across with the ported layer and are not __NS_TITLE__'s yet. Re-point them from
  the __NS_TITLE__ Figma frames — see `frontend/styles/DESIGN.md`.
- Templates are **stock Horizon**. __NS_TITLE__'s own templates and its header/footer
  sections are still to be built from the frames.

---

## Environments

Not wired yet. The store exists and does **not** run Horizon today — this repo is
a new theme for it, so nothing here is live until someone publishes it.

| Theme | Role |
|-------|------|
| `main` → live | Planned: Shopify's GitHub integration syncs the branch to the published theme. Deploying is then `git push origin main`. |
| unpublished dev theme | The `development` environment in `shopify.theme.toml`. Scratchpad for `yarn dev` and `yarn push`. |

Before the first `yarn dev`:

1. Copy `example.shopify.theme.toml` to `shopify.theme.toml` and fill in the
   store domain, an unpublished theme id and a theme access token (`shptka_…`).
2. Push once to create the scratchpad theme, and confirm which theme serves the
   storefront with the `theme;desc=` field in a response's `server-timing` header.

- **MUST NOT** add the live theme to `shopify.theme.toml` once the GitHub
  integration owns it. `yarn push` targets the unpublished scratchpad by design.
- Theme ids change when someone connects or reconnects a branch. Check
  `shopify theme list` before trusting an id.
- `config/settings_data.json` is tracked, because Shopify commits theme-editor
  changes back to the branch. Never gitignore it.

---

## Code standards

### File size

- **SHOULD** keep TypeScript files under **500 lines**. Past that, split by
  responsibility: a `.types.ts` companion, a shared utility, a second component.
- **SHOULD** keep Liquid files under 500 lines too, but templates win ties —
  splitting a section into snippets that each need six parameters is worse than
  one long section.
- One section = one Liquid file at the theme root plus one folder under
  `frontend/modules/sections/` holding its TypeScript, types and SCSS partial.
  Deleting the folder deletes the section.

### Extend, never edit

- **MUST** add behaviour in `frontend/`, never by editing a compiled theme asset
  in `assets/`. Vendor assets are overwritten by the next base-theme upgrade.
- **MUST** wrap rather than modify: a new custom element that decorates the
  theme's markup survives an upgrade; a patched core file does not.

### Custom elements

`__NS_TITLE__Element` already implements the lifecycle. Extend it rather than
`HTMLElement`, and the rules below are handled for you.

- **MUST** register through `defineElement()`, which guards
  `customElements.get(name)` — the theme editor re-runs the bundle.
- **MUST** put mount work in `mounted()` and anything `on()` does not cover —
  observers, timers, subscriptions — in `unmounted()`.
- **MUST** add listeners with `this.on()`. It binds them to an `AbortController`
  that aborts on disconnect, so they cannot drift out of sync with the bind site.
  A handler added directly with `.bind(this)` never detaches.
- **MUST NOT** guard the mount with a one-shot `isInitialized` flag.
  `disconnectedCallback` also fires when an element is *moved*, and a one-shot
  flag leaves the moved element permanently dead. The controller is the guard.

### TypeScript

- **MUST** use `import type { ... }` for type-only imports.
- **SHOULD** default to `type`; reach for `interface` only when declaration
  merging is required.
- **MUST** keep a section's types in its `.types.ts` companion, not in the
  component file.
- **MUST** mark immutable fields `readonly` and constant objects `as const`.
- **MUST NOT** leave unused parameters or variables behind.

### Naming

- Function-scoped variables: `_prefixed` (`_element`, `_config`).
- Class members: unprefixed (`private container`, not `private _container`).
- Types and classes: `PascalCase`. Constants: `UPPER_SNAKE_CASE`.
- Functions: `camelCase` with an action verb (`fetchCart`, `handleClick`).
- CSS: BEM (`.block__element--modifier`) plus state classes `.is-active`,
  `.is-loading`, `.is-open`. Never bare `.active` or `.loading`.

### Styling

- **MUST** open every partial with `@use 'utils' as u;`.
- **MUST** size with `u.rem()` and `u.fluid()`, never raw `px` (hairlines aside),
  so type and spacing scale with the viewport.
- **MUST** take colour from `u.role()`, type from `@include u.type()`, and
  breakpoints from `@include u.min('md')`, mobile-first.
- **MUST** override stock Horizon by re-pointing its variables in
  `base/_horizon-bridge.scss`, never by overriding Horizon selectors, and never
  inside `@layer`.
- `frontend/styles/DESIGN.md` is the token and component reference.

#### Size scales, breakpoints rearrange

A breakpoint changes what the layout *is* — one column becomes two, five tiles
become three, a heading moves beside its cards. It is not where a value gets
bigger. Every size between the two artboards comes from `u.fluid()`, which is
`clamp()` over `frontend/styles/utils/_vw-calc.scss`, so a viewport the frames
never drew still gets a considered value rather than the nearest step.

- **MUST** write padding, gaps, track widths, media windows, icon sizes and
  component heights as `u.fluid(min, max)`. A bare `u.rem()` on any of those is
  a desktop value a phone will also receive.
- **MUST** make a shared component fluid by default. A component exists to be
  defined once and reused, so a fixed size inside one is not a local mistake —
  it is the same wrong value shipped to every section that reuses it, and to
  every viewport those sections are seen at. The same goes for anything in
  `styles/utils/_tokens.scss`: a token is the most-reused value in the system,
  so a fixed one propagates furthest. `$control`, `$space` above `md`, `$layout`
  and the type scale are fluid for that reason.
- **MUST** size the parts of a component, not just its box. A fluid outer
  padding around a fixed label, a fixed icon and a fixed inner gap still steps —
  the component keeps a desktop footprint on a laptop, and what breaks is the
  row it sits in rather than the component itself. The button pair in the hero
  is the worked example: it stopped fitting at 1024 because its padding was
  fluid and its label, icon and gap were not.
- **MUST NOT** use a breakpoint to shrink something. If a value is wrong at 1024
  it is wrong at 1180 too, and a second breakpoint only moves the seam.
- **MUST NOT** cap a track with `min(50%, 42%)` or the same idea spelled as an
  override inside `@include u.min()`. Give the neighbouring track a fluid floor
  with `minmax(u.fluid(a, b), 1fr)` and let the grid resolve the rest — the
  columns then trade width continuously instead of jumping at the seam.
- **SHOULD** keep `u.rem()` for values that genuinely do not scale: hairline
  borders, a pagination dot, an icon drawn at one size, the `xs`–`md` space
  steps.
- **SHOULD** check a new value at 390, 768, 1024 and 1440 before calling it done.
  1024 is where laptop layouts break, because it is the breakpoint most rules
  land on.

### The cart

Liquid Ajax Cart owns every write to the cart. `yarn check:boundary` enforces
the contract; these are the rules it checks.

- **Every `{% form 'product' %}` that can add to the cart sits inside
  `<ajax-cart-product-form>`**, with exactly one form and one
  `[data-ajax-cart-errors="form"]` target inside the wrapper. A form that loses
  its wrapper does not error — it quietly navigates to `/cart` instead of
  opening the drawer.
- **A submit button's `name` and `value` never reach the cart.** The library
  builds its payload with `new FormData(form)`, which leaves out the submitter.
  Anything the button was carrying — a selling plan, a line property — belongs
  in a real input. See the `selling_plan` mirror in `__NS__-product-buy-box`.
- **Horizon's cart scripts stay off the page:** `product-form`,
  `sticky-add-to-cart`, `fly-to-cart`, `cart-drawer`, `quick-order-list` and the
  standard-actions override. Two libraries on one submit is a double add.
  `cart-discount`, `cart-note` and `component-cart-items` do stay — they drive
  `/cart`, which is still Horizon's and where the drawer is gated off.
- **The drawer is `__NS__-cart-drawer`, never `cart-drawer`.**
  `snippets/theme-drawer.liquid` reopens saved drawers by id out of
  `sessionStorage`, setting `open` as a plain attribute — which shows the panel
  with no backdrop and no focus trap.
- **Nothing in `frontend/` imports `@theme/…` or reads `window.Theme`.** Those
  are Horizon's, and an upgrade replaces them. Read `window.__NS__`.

A Horizon upgrade overwrites every unprefixed file, so it can undo any of this
without a single test failing. Run the guard first after one.

### Things that fail review

- `console.*` anywhere outside the logging utility — use `consoleMessage()`.
- Magic numbers in components — put them in `frontend/modules/constants/`.
- Utility class names in Liquid (`.flex`, `.mt-4`) — semantic names only.
- A listener added in `connectedCallback()` with no matching teardown.
- `querySelector` called repeatedly in a handler instead of caching on init.
- Desktop-first CSS. Mobile styles are the base; `@include u.min()` adds.
- Hardcoded `px` sizes where `u.rem()` or `u.fluid()` belongs.
- A fixed `u.rem()` on a padding, gap, grid track or media window. Those are the
  values a laptop feels first; they belong in `u.fluid()`.
- A fixed size anywhere in `styles/components/`, `modules/elements/` or
  `utils/_tokens.scss`. Reuse multiplies it.
- A component whose box scales but whose label, icon and inner gap do not.
- A breakpoint that only resizes something, or a `min()` cap on a grid track.
  Sizes interpolate; breakpoints rearrange.
- An `<img>` written by hand instead of `__NS__-image`, or a `__NS__-image` call
  without `section_index: section.index` — that is what decides eager against
  lazy and the `fetchpriority` that goes with it.
- A second `<img>` hidden in CSS for mobile art direction. Hidden images still
  download; use the `mobile_image` parameter, which emits a `<picture>` source.
- A second animation library. `motion` is the only one, and only `<__NS__-reveal>`
  uses it; everything else is a CSS transition.
- Animating `width`/`height`/`top`/`left` — use `transform` and `opacity`, and
  honour `@media (prefers-reduced-motion: reduce)`.

### Before committing

`yarn type-check && yarn lint && yarn check:boundary && yarn build`, then confirm
`shopify theme check` still matches the recorded baseline.

---

## Quick Commands

```bash
yarn run dev       # Start development
yarn run build     # Build assets
yarn run deploy    # Deploy to Shopify
```
