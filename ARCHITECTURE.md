# Frontend architecture

How custom code is organised in a Benchmark Shopify theme, and why. The rules
below are portable: nothing here is specific to one storefront, and the tag
prefix (`mb-` in Morrow) is the only per-project value.

Last revised 2026-09-17.

---

## 1. The constraints this shape answers

Four facts drive every decision. None of them are preferences.

| Constraint | Consequence |
|------------|-------------|
| Shopify requires `sections/`, `snippets/`, `blocks/` at the theme root | Liquid can never be co-located with its behaviour |
| Custom element names must contain a hyphen | The tag keeps a prefix even when filenames drop it |
| Sass cares about `@use` order, not file location | Partials may live anywhere; the ordered list stays in one entrypoint |
| Element modules register tags as a side effect | Barrels must import for effect, not re-export |

A base-theme upgrade adds a fifth: every custom Liquid file carries the prefix,
so "overwrite everything unprefixed" is a safe upgrade.

---

## 2. Layout

```
sections/mb-<name>.liquid         markup — theme root, prefixed, owned by Shopify's layout
snippets/mb-<name>.liquid         reusable markup

frontend/
  entrypoints/
    storefront.ts                 imports core, then elements, then sections
    custom_styling.scss           the ordered @use list — the whole cascade
  modules/
    elements/
      index.ts                    side-effect imports for tag-registering elements
      tabs/
        index.ts                  export * from './tabs'
        tabs.ts                   class Tabs + defineElement('mb-tabs', Tabs)
        tabs.types.ts
        _tabs.scss                only if the element ships styling
      carousel/                   plain module — dynamically imported, not in the barrel
    sections/
      index.ts                    side-effect imports for every section
      header/
        index.ts
        header.ts                 class Header + defineElement('mb-header', Header)
        header.types.ts
        _header.scss
    core/                         global bootstrap (window.<namespace>)
    utils/                        consoleMessage, defineElement, parseElementConfig, …
    constants/                    breakpoints, durations, event names
    types/                        cross-module types
  styles/
    tokens/  base/  utils/        design system: primitives, bridge, mixins
    components/                   snippet-level primitives (button, badge, …)
```

**One folder per thing the theme renders.** Deleting the folder deletes the
section — no orphaned partial three directories away.

---

## 3. Elements build sections

An **element** is reusable behaviour with its own lifecycle: tabs, accordion, a
carousel wrapper, cart state. A **section** composes elements and adds only what
is unique to it.

Sections stay thin. Many need no TypeScript at all once the elements exist.

### The promotion rule

Move behaviour into `elements/` on its **second** consumer, not its first. A
shared API designed against one caller is a guess, and guesses calcify.

The corollary: leave a comment at the first consumer naming the future move, so
the second one doesn't quietly duplicate it instead.

### Two kinds of element

| Kind | Registered how | Example |
|------|----------------|---------|
| Custom element | side-effect import in `elements/index.ts` | `tabs` |
| Plain module | dynamic `import()` at the call site | `carousel` |

A plain module must **not** appear in the eager barrel. A static import pulls its
dependency into the main bundle — for the carousel that means shipping Embla to
every page, which is exactly what the dynamic import exists to prevent.

---

## 4. Naming

| Thing | Form | Example |
|-------|------|---------|
| Tag | prefixed, hyphenated | `mb-header` |
| Liquid | prefixed, theme root | `sections/mb-header.liquid` |
| Folder | unprefixed | `modules/sections/header/` |
| Module | unprefixed, matches folder | `header.ts` |
| Class | PascalCase, unprefixed | `Header` |
| Config type | `<Name>Config` | `HeaderConfig` |
| Sass partial | leading underscore | `_header.scss` |

The prefix survives where it does work — the tag, and the Liquid files an
upgrade must be able to tell apart. Inside `frontend/` the folder already says
what a file is, so repeating it is noise.

The Sass underscore is convention, not namespacing: it marks a partial that is
never compiled on its own.

---

## 5. Barrels

Root barrels use **bare side-effect imports**:

```ts
// modules/sections/index.ts
import './header';
import './hero';
```

Not re-exports. Importing the module is what calls `defineElement`, and a
bundler is entitled to drop a re-export whose symbols nobody reads. The failure
mode is nasty: no error, no warning, a tag simply never registers. If
`package.json` ever gains `"sideEffects": false`, re-export barrels break
silently and side-effect imports keep working.

Folder-level barrels re-export for typed consumers:

```ts
// modules/sections/header/index.ts
export * from './header';
export type * from './header.types';
```

---

## 6. Styles

Partials live with their module; **order lives in one place**:

```scss
// frontend/entrypoints/custom_styling.scss
@use '../styles/tokens/emit';          // tokens first — everything reads them
@use '../styles/base/horizon-bridge';  // then the base-theme bridge
@use '../styles/components/button';    // then snippet primitives
@use '../modules/sections/header/header';
```

The tiers are load-bearing; order *within* the section block is not.

**What stays in `styles/` rather than moving into a module:**

- tokens, base, mixins — global by definition
- snippet-level primitives (button, badge, progress, card) — a folder holding
  one `.scss` file and nothing else is ceremony

**What moves into a module:** anything a single section or element owns.

---

## 7. Adding a new section

1. `sections/mb-<name>.liquid` — markup, `<mb-<name>>` as the root, schema
2. `frontend/modules/sections/<name>/<name>.ts` — class, `defineElement()` last
3. `<name>.types.ts` — config type, keys mirroring the schema setting ids
4. `_<name>.scss` — mobile-first, tokens only
5. `index.ts` — `export * from './<name>'`
6. Add `import './<name>';` to `modules/sections/index.ts`
7. Add the `@use` line to `custom_styling.scss`

Steps 6 and 7 are the two that fail silently when forgotten: no barrel entry
means the tag never registers; no `@use` means the styles never ship.

If the behaviour already exists as an element, steps 2, 3 and 5 disappear.

---

## 8. Moving an existing theme onto this layout

Mechanical, and worth doing in one commit so nothing renders half-migrated.

1. `frontend/scripts` → `frontend/modules`
2. `modules/components/sections/mb-<n>.*` → `modules/sections/<n>/<n>.*`
3. `modules/components/shared/*` → `modules/elements/<n>/`
4. Section partials from `styles/sections/` and `styles/components/` into their
   module folders; primitives stay behind, prefix dropped
5. Drop `Mb` from class and config-type names; keep it in `defineElement()`
6. Write the barrels (§5)
7. Repoint `@` in **both** `vite.config.js` and `tsconfig.json`
8. Repoint any path-scoped `eslint.config.js` override — this one fails loudly
   only after everything else already passes
9. Rewrite the `@use` list in the styles entrypoint
10. Update `CLAUDE.md`, `.claude/CLAUDE.md`, `frontend/CLAUDE.md`

Verify with `yarn type-check`, `yarn lint`, a Vite request for both entrypoints,
and a rendered page — a passing type-check alone will not catch a missing
`@use` or a dropped barrel entry.
