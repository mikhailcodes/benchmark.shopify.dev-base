# Shopify Theme Development Environment

Vite + TypeScript + SCSS on top of a Shopify theme, with the build committed to
Git so Shopify's GitHub integration can sync it.

This document is the decision record as much as the instructions. Read
"Decisions" before running anything — the answers change what you scaffold.

---

## Table of contents

1. [Decisions](#decisions)
2. [Path A — existing live theme](#path-a--existing-live-theme)
3. [Path B — brand new build](#path-b--brand-new-build)
4. [Shared setup](#shared-setup)
5. [The namespace rule](#the-namespace-rule)
6. [Branches, themes and who owns what](#branches-themes-and-who-owns-what)
7. [Theme settings](#theme-settings)
8. [Architecture](#architecture)
9. [Gotchas that have actually bitten us](#gotchas-that-have-actually-bitten-us)
10. [Post-setup checklist](#post-setup-checklist)

---

## Decisions

Answer these five before touching the filesystem. Everything downstream follows.

### 1. Existing theme, or new build?

| | Existing live theme | Brand new build |
|---|---|---|
| First action | Pull the live theme, commit it untouched | Pull the chosen base theme at a known version |
| Baseline commit | "the merchant's theme as of <date>" | "Horizon x.y.z, unmodified" |
| Risk to manage | Overwriting merchant customisations | None yet — establish conventions early |
| `config/settings_data.json` | **Sacred.** Contains live merchant settings | Defaults; still tracked |

Take [Path A](#path-a--existing-live-theme) or [Path B](#path-b--brand-new-build).
Both converge on [Shared setup](#shared-setup).

### 2. Which base theme?

**Horizon**, unless the theme is going to the Shopify Theme Store.

Horizon is Shopify's current flagship: theme blocks with 8 levels of nesting, web
components on the storefront, frequent updates. Its one disqualifier is that
themes derived from Horizon are **not eligible for Theme Store submission** —
which is precisely why Shopify ships **Skeleton**, a bare scaffold, for that case.

- Building one merchant's storefront → **Horizon**.
- Building a theme to sell in the Theme Store → **Skeleton**.
- Inheriting a Dawn-based theme → leave it on Dawn; a base-theme migration is a
  rebuild, not an upgrade. Scope it separately.

Record the exact base version in the baseline commit message. You will want it
when the first upgrade lands.

### 3. Is Shopify's GitHub integration in play?

This is the decision people get wrong, and it silently destroys merchant data.

| | GitHub integration connected | CLI-driven only |
|---|---|---|
| Who deploys | Shopify, from the branch | You, via `shopify theme push` |
| `config/settings_data.json` | **Must be tracked.** Shopify commits theme-editor changes back to the branch | May be gitignored |
| `shopify.theme.toml` | Only needs the dev environment | Needs one environment per theme |
| CI's job | **Commit built assets back to the branch** so Shopify syncs them | Just verify assets are in sync |

If a branch is connected to Shopify and you gitignore `settings_data.json`, the
first push replaces the merchant's live theme settings with nothing. Track it.

The usual shape: `main`/`staging`/`qa` connected to Shopify, plus one unpublished
`[Dev]` theme driven from the CLI for local work.

### 4. Namespace prefix

Pick a 2–8 character prefix for every custom Liquid file — `refuge-`, `sc-`,
whatever fits the store. See [The namespace rule](#the-namespace-rule). Decide it
now; renaming later touches every `{% render %}` call.

### 5. Stack

TypeScript + SCSS, Yarn 4, Vite. These are no longer options in this template —
every project converged on them, and keeping the alternatives alive meant the
generated code was never good at any of them.

---

## Path A — existing live theme

The goal is a baseline commit that is byte-identical to what is live, so every
later diff is unambiguously yours.

```bash
git init
gh repo create <org>/<store>.shopify --private --source=. --remote=origin

# Confirm which theme is actually live before pulling — roles change in the admin.
SHOPIFY_CLI_THEME_TOKEN=shptka_xxx shopify theme list --store <store>.myshopify.com

SHOPIFY_CLI_THEME_TOKEN=shptka_xxx \
  shopify theme pull --store <store>.myshopify.com --live --path .
```

Commit it before adding anything:

```bash
git add -A
git commit -m "chore(theme): pull live theme as baseline

Pulled '<theme name>' (#<id>) from <store>.myshopify.com as the untouched
starting point. Base theme: Horizon x.y.z."
```

Two things to verify at this point:

- `config/settings_data.json` exists and is **not** gitignored. It holds the
  merchant's live settings and it is the one file you cannot regenerate.
- Run `shopify theme check` and record the offence count. That is your baseline;
  pre-existing offences in core theme files are not yours to fix, and you want to
  be able to prove that later.

Then go to [Shared setup](#shared-setup).

## Path B — brand new build

```bash
git init
gh repo create <org>/<store>.shopify --private --source=. --remote=origin

# Horizon, unless building for the Theme Store — see decision 2.
shopify theme init --clone-url https://github.com/Shopify/horizon
```

Commit the unmodified base with its version in the message, then create the
themes you need up front:

```bash
shopify theme push --unpublished --theme "[Dev] <Store>"
```

Only create `[Staging]`/`[QA]` themes if you are **not** using the GitHub
integration. If you are, Shopify creates and syncs those themes itself when you
connect the branches, and a hand-made theme of the same name just competes with
it.

Then go to [Shared setup](#shared-setup).

---

## Shared setup

### 1. Toolchain

Yarn 4 is pinned through Corepack, so the version lives in the repo rather than
on each machine:

```bash
corepack enable
yarn set version 4
```

`.yarnrc.yml`:

```yaml
# PnP breaks the Shopify CLI and vite-plugin-shopify, both of which resolve and
# spawn binaries from a real node_modules tree.
nodeLinker: node-modules
```

Do not change `nodeLinker`. Yarn 4 also disables dependency install scripts by
default; nothing in this stack needs them (esbuild ships native binaries as
optional platform packages). If a future dependency does, allow it per package
with `dependenciesMeta.<pkg>.built: true` rather than re-enabling `enableScripts`
globally.

### 2. Dependencies

```bash
yarn add -D vite vite-plugin-shopify typescript @types/node sass \
  eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  npm-run-all postcss
```

### 3. Scripts

Only create scripts for themes you actually push to from the CLI. A `deploy:staging`
that targets a Shopify-managed theme is a footgun, not a convenience.

```json
{
  "packageManager": "yarn@4.18.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "run-p -sr \"shopify:dev\" \"vite:dev\" --",
    "build": "vite build",
    "deploy": "run-s \"build\" \"push\" --",
    "push": "shopify theme push --environment development",
    "pull": "shopify theme pull --environment development",
    "shopify:dev": "shopify theme dev --environment development --live-reload=hot-reload",
    "vite:dev": "vite",
    "vite:build": "vite build",
    "type-check": "tsc --noEmit",
    "lint": "eslint frontend",
    "clean": "rm -rf dist assets/storefront-*.js assets/styles-*.css assets/.vite"
  }
}
```

### 4. `shopify.theme.toml`

Gitignored. `password` is the **theme access token**; `store_password` is the
**storefront password** for a password-protected store. They are different
credentials and putting one in the other's field produces confusing failures.

```toml
[environments.development]
store = "<store>.myshopify.com"
theme = "<dev theme id>"
password = "shptka_..."       # theme access token
store_password = "..."         # storefront password, only if the store is locked
```

Commit an `example.shopify.theme.toml` with empty credentials.

### 5. Wire the bundle into the layout

This is the one unavoidable core-file edit. Add to `layout/theme.liquid`'s
`<head>`, and record it in the debt table in `CLAUDE.md`:

```liquid
{%- render '<prefix>-theme-settings' -%}
{%- render 'vite-tag' with 'styles.scss' -%}
{%- render 'vite-tag' with 'storefront.ts' -%}
```

### 6. Verify, then commit

```bash
yarn type-check && yarn lint && yarn build
shopify theme check          # compare against the baseline offence count
```

Commit source **and** built assets together. CI verifies they match.

---

## The namespace rule

Every custom Liquid file carries the project prefix:

| Kind | Path |
|---|---|
| Snippets | `snippets/<prefix>-*.liquid` |
| Sections | `sections/<prefix>-*.liquid` |
| Styles / scripts | `frontend/**`, compiled into `assets/` |

An upgrade then becomes: overwrite every non-prefixed file, and whatever survives
is yours. Without it, an upgrade is a hand-merge of every file you ever touched.

**Core files get additive edits only, and each one is a debt.** Keep a table in
`CLAUDE.md`:

| File | Change | Why unavoidable |
|---|---|---|
| `layout/theme.liquid` | Renders the settings snippet and `vite-tag` | No extension point for adding to `<head>` |
| `config/settings_schema.json` | Appends one settings group at the end | Global settings have no other home |

Before editing any other core file, try a theme setting, a section, a block, or a
metafield first. Those survive updates untouched.

### Applying an upgrade

1. Branch from `main`.
2. Pull the new base release over the working tree.
3. Restore the prefixed files and re-apply the debt table.
4. Confirm `config/settings_data.json` still holds the merchant's values.
5. `yarn build`, then load the styleguide page — it renders every shared snippet,
   so a renamed token shows up there first.
6. `shopify theme check` — compare against the recorded baseline.

---

## Branches, themes and who owns what

`main` (production), `staging`, `qa`. Feature branches cut from `main`.

When the GitHub integration is connected, Shopify owns those three themes. CI's
job on those branches is to compile `frontend/` and **commit the built assets back
to the branch**, because that commit is what Shopify syncs.

```yaml
name: Build

on:
  push:
    branches: [main, staging, qa]
  pull_request:
    branches: [main, staging, qa]

# Assets derive entirely from source, so only the newest push per branch is worth
# building. Cancelling superseded runs also stops two of them racing to push their
# asset commit, which leaves one rejected with "fetch first".
concurrency:
  group: build-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    # Without this guard, the workflow's own asset commit triggers another build.
    if: github.actor != 'github-actions[bot]' && github.actor != 'shopify[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      # Corepack must be enabled before any yarn call. setup-node's built-in yarn
      # cache runs earlier and would probe the runner's preinstalled Yarn 1.
      - run: corepack enable

      - id: yarn-cache
        run: echo "dir=$(yarn config get cacheFolder)" >> "$GITHUB_OUTPUT"

      - uses: actions/cache@v4
        with:
          path: ${{ steps.yarn-cache.outputs.dir }}
          key: yarn-${{ runner.os }}-${{ hashFiles('yarn.lock') }}
          restore-keys: yarn-${{ runner.os }}-

      - run: yarn install --immutable
      - run: yarn type-check
      - run: yarn lint
      - run: yarn build

      - name: Commit built assets
        if: github.event_name == 'push'
        id: commit
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          git add -A assets snippets/vite-tag.liquid
          if [[ -n $(git status --porcelain) ]]; then
            git commit -m "chore(assets): compile theme assets"
            echo "changes=true" >> $GITHUB_OUTPUT
          else
            echo "changes=false" >> $GITHUB_OUTPUT
          fi

      - name: Push built assets
        if: github.event_name == 'push' && steps.commit.outputs.changes == 'true'
        run: |
          for attempt in 1 2 3; do
            git push origin HEAD:${{ github.ref_name }} && exit 0
            git fetch origin ${{ github.ref_name }}
            # In a rebase 'theirs' is the commit being replayed — the assets this
            # run just built, which is the correct winner for generated output.
            git rebase -X theirs origin/${{ github.ref_name }} || {
              git rebase --abort; exit 1;
            }
          done
          exit 1

      - name: Verify assets are in sync (PR)
        if: github.event_name == 'pull_request'
        run: git diff --exit-code assets/ snippets/vite-tag.liquid
```

---

## Theme settings

Custom settings live in **one group appended last** in
`config/settings_schema.json`, every id prefixed. Appending at the end keeps
re-applying it after an upgrade a copy-paste rather than a merge.

Getting them into JS does not require touching Liquid again. A
`<prefix>-theme-settings.liquid` snippet serialises the group to JSON, and a typed
reader parses it:

```liquid
<script type="application/json" id="<prefix>-settings">
  { "revealEnabled": {{ settings.<prefix>_reveal_enabled | default: true | json }} }
</script>
```

Keep defaults in the TypeScript reader as well as the schema, so the bundle still
runs against a theme that predates a setting. Malformed JSON should log and fall
back, never throw.

Prefer a **section** setting over a global one. Global settings are the only
reason `settings_schema.json` is a file you re-apply on every upgrade.

### Deprecating a setting

Shopify has no native deprecation flag, so this is a convention.

Never delete an id outright. Merchant values live in `config/settings_data.json`,
and Liquid reading a removed id returns `nil` silently — it surfaces as content
quietly disappearing, not an error.

1. Move it under a `Deprecated` header at the bottom of the group.
2. Prefix the label `Deprecated — `.
3. Put the replacement and intended removal date in `info`.
4. Gate it: `"visible_if": "{{ settings.<prefix>_show_deprecated == true }}"`.
5. Keep the code reading it, falling back to the replacement.
6. Track it in a table in `CLAUDE.md` until it is safe to remove.

Deleting the schema entry does **not** delete the stored value. Re-adding the same
id later resurrects the old value, which is a genuinely confusing bug to chase.

---

## Architecture

### The tag is the initiator

Every custom section is a custom element. The tag in the Liquid markup boots the
behaviour — there is no registry, no boot loop, no `querySelectorAll` pass, and no
`data-section-type`. The browser upgrades the element and calls
`connectedCallback()`.

This replaced an earlier `BaseComponent` + `useSectionLifecycle` registry. Three
classes of bug went with it:

- **Two-step construction.** A subclass's field initialisers do not run until
  after `super()` returns, so a base constructor that called `init()` saw every
  subclass field as `undefined`. That shipped once and crashed the first
  component built on it. A custom element has no such split: the browser
  constructs, then calls `connectedCallback()`.
- **`this.constructor.name`.** The minifier mangles it, so every component had to
  redeclare its own name. A tag name is a string literal in `defineElement()`.
- **Registry drift.** Tag name, `data-section-type`, and the `registerSection()`
  key all had to agree. Now there is one name.

```typescript
import { consoleMessage, defineElement, parseElementConfig } from '@/utils';
import type { <Prefix>CartDrawerConfig } from './<prefix>-cart-drawer.types';

const DEFAULT_CONFIG: <Prefix>CartDrawerConfig = { close_on_escape: true };

export class <Prefix>CartDrawer extends HTMLElement {
  private controller: AbortController | null = null;
  private config: <Prefix>CartDrawerConfig = DEFAULT_CONFIG;
  private isInitialized = false;

  connectedCallback(): void {
    if (this.isInitialized) return;

    this.config = parseElementConfig(this, DEFAULT_CONFIG);
    this.controller = new AbortController();

    this.addEventListener('click', this.handleClick, { signal: this.controller.signal });

    this.isInitialized = true;
  }

  disconnectedCallback(): void {
    this.controller?.abort();
    this.controller = null;
    this.isInitialized = false;
  }

  private handleClick = (event: Event): void => {
    const _toggle = (event.target as HTMLElement | null)?.closest('[data-cart-toggle]');
    if (!_toggle) return;

    this.classList.toggle('is-open');
  };
}

defineElement('<prefix>-cart-drawer', <Prefix>CartDrawer);
```

One `AbortController` owns every listener, so `disconnectedCallback()` releases
them all at once and cannot drift out of sync with the bind sites.

### One section, four files

| File | Purpose |
|------|---------|
| `sections/<prefix>-carousel.liquid` | Markup, with the tag as the root element |
| `frontend/scripts/components/sections/<prefix>-carousel.ts` | Behaviour + `defineElement()` |
| `frontend/scripts/components/sections/<prefix>-carousel.types.ts` | Config type |
| `frontend/styles/sections/_<prefix>-carousel.scss` | Styles, opening with `@use 'utils' as u;` |

Registration is one line in `frontend/scripts/components/sections/index.ts`:

```typescript
import './<prefix>-carousel';
```

That barrel is imported by the entrypoint, and forgetting it is the only way a
section fails to mount. The namespace prefix gives the tag its required hyphen
for free.

### Sizing: rem and fluid helpers

`frontend/styles/utils/` holds the helpers every partial opens with. They resolve
through a `loadPaths` entry in `vite.config.js`, so the import never changes with
nesting:

```scss
@use 'utils' as u;
```

| Helper | Use |
|--------|-----|
| `u.rem(16)` | px to rem. Lists work: `u.rem(16 24)` -> `1rem 1.5rem`. |
| `u.rem-calc(16)` | Alias of `u.rem()`, so call sites from older themes paste over unchanged. |
| `u.fluid(24, 40)` | Scales linearly between the 390px and 1728px viewports, clamped at both ends. |
| `u.spacing('lg')` | Spacing token. `xs`–`md` fixed, `lg`–`xxl` fluid. |
| `u.transition('base')`, `u.radius('md')`, `u.color('text')` | The other token scales. |
| `@include u.min('md')` | Mobile-first breakpoint. Also `u.max()`, `u.between()`. |
| `@include u.reduced-motion` | The `prefers-reduced-motion: reduce` block. |

**How `fluid()` works.** It solves the line through two points — the min size at a
390px viewport and the max at 1728px — and emits the result as a `clamp()`:

```scss
padding: u.fluid(24, 40);
// clamp(1.5rem, 1.20852rem + 1.19581vw, 2.5rem)
```

The `vw` term is the slope, the `rem` term the intercept, and `clamp()` stops
growth outside the range. At 390px that evaluates to 24px, at 1728px to 40px,
and it interpolates between — one declaration instead of a base value plus two
breakpoint overrides.

The three-value form from harmony, `u.fluid((16, 24, 32))`, still compiles: the
middle value never affected the curve there either, so it is read as min and max.

**How to use it.** Type and any spacing large enough to set the page rhythm go
through `fluid()`. Small fixed gaps, borders and radii go through `rem()`. Raw
`px` is a review failure, hairline borders aside.

```scss
@use 'utils' as u;

<prefix>-carousel {
  display: block;
  padding: u.spacing('lg') u.spacing('md');
}

.<prefix>-carousel__heading {
  font-size: u.fluid(24, 40);
  margin-bottom: u.rem(8);
}

@include u.min('md') {
  <prefix>-carousel {
    padding: u.spacing('xl') u.spacing('lg');
  }
}
```

A value two sections share is a token, not a literal — add it to
`frontend/styles/utils/_tokens.scss`. The entrypoint mirrors every token scale
into `:root` as custom properties, so Liquid and one-off styles can reach them as
`var(--spacing-lg)` without importing anything.

### Import order in the entrypoint is load-bearing

```typescript
import 'vite/modulepreload-polyfill';
import '@/core/global';
import '@/components/sections';
```

ES modules evaluate dependencies in declaration order, and an element upgrades the
moment it is defined. The global object has to exist before that first upgrade, or
logging is silent and `dispatchStoreEvent()` throws during init.

### Mount strategies

The element lifecycle covers eager mounting. Anything heavier is deferred inside
`connectedCallback()`:

| Strategy | How | Use for |
|---|---|---|
| Eager | plain `connectedCallback()` | above-the-fold content |
| Visible | `whenVisible(this, fn)` — `IntersectionObserver` | everything below the fold |
| Lazy chunk | `await import('@/components/shared/…')` | anything with a real dependency |

A dynamic import is also the code-splitting boundary: the chunk is fetched only by
pages carrying the tag. `whenVisible()` returns a teardown that
`disconnectedCallback()` must call — an observer left running outlives the element.

### Theme editor

Section load and unload need no code at all. A settings change re-renders the
section HTML, which destroys the old element and constructs a new one; markup
fetched through the Section Rendering API boots identically.

Block select and deselect are the exception, because they fire without
re-rendering anything. They bubble from the block up through the section root, so
the element listens on itself:

```typescript
this.addEventListener('shopify:block:select', this.handleBlockSelect, { signal });
```

### Wiring a section in Liquid

```liquid
<<prefix>-carousel
  class="<prefix>-carousel"
  data-section-id="{{ section.id }}"
  data-config="{{ section.settings | json | escape }}"
>
```

`data-config` carries the whole settings object and `parseElementConfig()` merges
it over the defaults, warning on malformed JSON. `data-section-id` stays for the
Section Rendering API. No snippet, no scope juggling, no registry key to collide
on.

### Diagnostics

Expose a debug surface on the global object. The one that earns its keep is a
check for **which bundle is actually running** — `import.meta.env.DEV` is true only
in the Vite-served build, so it cannot be fooled by a stale asset:

```js
<global>.debug.info()        // source: 'local vite dev server' | 'compiled theme asset'
<global>.debug.elements()    // defined tags, and how many of each are on the page
<global>.debug.vitals()      // Core Web Vitals so far
<global>.debug.devMode(true) // enable logging, persisted
```

Defined-but-absent and present-but-not-upgraded are the two states worth
surfacing. `document.querySelectorAll(tag).length` against
`customElements.get(tag)` tells you both.

**Error-level logs must never be gated behind a debug flag.** A swallowed
initialisation error is exactly the one you need to see.

### Styleguide

Ship a `page.styleguide` template rendering a `<prefix>-styleguide` section that
displays every shared snippet against the theme's live CSS custom properties.

It is built from the same snippets production uses, so it doubles as the upgrade
smoke test. Add a shared snippet, add it to the styleguide.

Horizon has no `data-section-type` convention — Shopify only wraps sections in
`#shopify-section-{{ section.id }}`. A `<prefix>-section-attrs` snippet emits what
the registry binds to:

## Gotchas that have actually bitten us

1. **`.shopifyignore` needs globs.** `frontend/` does not match anything; it must
   be `frontend/**`. A bare directory name silently uploads your source.
2. **`yarn dev` rewrites `snippets/vite-tag.liquid`** to point at
   `127.0.0.1:5173`. Committing it in that state breaks the theme for everyone
   else. `yarn build` restores it.
3. **`assets/.vite/manifest.json` must be committed.** The cleanup plugin reads it
   to delete the previous build's hashed assets; without it, CI has no record and
   old assets accumulate forever. A blanket `.vite/` ignore swallows it.
4. **Shopify rejects subfolders under `assets/`**, so `assets/.vite/**` must be in
   `.shopifyignore` even though it is committed to Git.
5. **`config/settings_data.json` is not scratch.** See decision 3.
6. **Check theme roles before pushing.** `shopify theme push` refuses to write to a
   live theme without `--allow-live`; leave that guard in place.
7. **A stray `package.json` in `$HOME`** makes Yarn 4 treat any repo beneath it as
   a nested workspace and refuse to install. An empty `yarn.lock` in the project
   resolves it.
8. **Minification is on by default**, which is the right call now that nothing
   depends on `this.constructor.name`. If you turn it off to keep assets
   patchable in the Shopify editor, expect ~2-3x raw bytes — the CDN still
   serves gzip either way.

---

## Post-setup checklist

- [ ] Baseline commit is the unmodified theme, with base version recorded
- [ ] `config/settings_data.json` tracked (if GitHub integration is connected)
- [ ] `assets/.vite/manifest.json` tracked, and in `.shopifyignore`
- [ ] `.shopifyignore` entries all use `/**`
- [ ] `shopify.theme.toml` gitignored; `example.` version committed
- [ ] Namespace prefix chosen and used by every custom Liquid file
- [ ] Core-file debt table in `CLAUDE.md` matches reality
- [ ] `yarn type-check && yarn lint && yarn build` pass
- [ ] `shopify theme check` baseline offence count recorded
- [ ] Styleguide page renders every shared snippet
- [ ] Every section tag is defined, and upgrades on the page that renders it
- [ ] CI green, and its asset commit lands on the branch

---

**Maintained by:** Mikhail Arden
