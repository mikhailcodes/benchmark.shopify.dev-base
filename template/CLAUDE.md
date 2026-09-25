# __NS_TITLE__ — Shopify theme

A Horizon-based Shopify theme. Custom code lives in `frontend/` and is compiled
into `assets/` by Vite; custom elements mount themselves, so there is no section
registry and no boot scan.

## Where the rules live

Four documents, none of them duplicating each other. Read the one that matches
what you are about to touch.

| Document | Covers |
|----------|--------|
| [.claude/CLAUDE.md](.claude/CLAUDE.md) | Project rules: namespacing, environments, code standards, what fails review |
| [frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md) | Why the module layout is shaped the way it is, and how to add a section |
| [frontend/CLAUDE.md](frontend/CLAUDE.md) | The custom-element pattern, theme-editor behaviour, SCSS helpers |
| [frontend/styles/DESIGN.md](frontend/styles/DESIGN.md) | Design tokens and component specs |

## Shape

```
sections/__NS__-<name>.liquid       markup — theme root, prefixed
snippets/__NS__-<name>.liquid       reusable markup
blocks/__NS__-<name>.liquid         blocks

frontend/
  entrypoints/
    storefront.ts                 core, then elements, then sections
    custom_styling.scss           the ordered @use list — the whole cascade
  modules/                        the `@` alias
    core/                         window.__NS__ bootstrap + the __NS_TITLE__Element base class
    elements/                     reusable behaviour with its own lifecycle
    sections/<name>/              one folder per section: .ts, .types.ts, _<name>.scss
    utils/  constants/  types/
  styles/
    tokens/  base/  utils/        design system: primitives, Horizon bridge, mixins
    components/                   snippet-level primitives (button, card, …)

assets/                           compiled output — never edit by hand
```

The tag carries the `__NS__-` prefix. Folders, files and classes inside
`frontend/modules/` do not — the folder already says what a file is.

## Commands

Yarn 4, not npm or Bun.

```bash
yarn dev          # Vite + Shopify CLI against the development theme
yarn build        # compile frontend/ into assets/
yarn type-check   # tsc --noEmit
yarn lint         # eslint frontend
yarn check:boundary  # the __NS_TITLE__/Horizon line — see .claude/CLAUDE.md
yarn push         # shopify theme push --environment development
```

### Ports

`yarn dev` starts two servers: the Shopify CLI preview on **9292** and Vite on
**5173**. Both read an environment variable, so another theme project can hold
the defaults:

```bash
SHOPIFY_PORT=9293 VITE_PORT=5174 yarn dev
```

Vite's port needs no other change — the CORS allowlist in `vite.config.js` covers
any `127.0.0.1` port, and vite-plugin-shopify rewrites `snippets/vite-tag.liquid`
to whichever port it binds.

Passing `--port` to `yarn dev` itself does not work: `run-p` forwards trailing
args to *both* children, so the CLI and Vite fight over one port.

## Critical rules

1. **Never create files in `assets/`** — it is build output. Custom code goes in
   `frontend/`.
2. **Never run `yarn build` or `shopify theme push` unless asked.** CI builds and
   commits assets on every push to `main`, `staging` and `qa`.
3. **Never push without being asked.**
4. **Semantic class names only** — BEM, no utility classes.
5. **Mobile-first CSS** — base styles are the phone, `@include u.min()` adds.
6. **Extend, never edit** — wrap Horizon's markup in a custom element rather than
   patching a core theme file.

## Image optimization

Do not add a Vite image plugin. Shopify's CDN already converts format per
browser, resizes on demand and serves globally, which no build-time step can
match. Every image goes through `snippets/__NS__-image.liquid`.

```liquid
{%- render '__NS__-image',
  image: section.settings.image,
  sizes: '(min-width: 1024px) 50vw, 100vw',
  section_index: section.index
-%}
```

## Security

- Credentials live in `.env` and `shopify.theme.toml`, both gitignored. Copy
  `example.shopify.theme.toml` to start.
- `config/settings_data.json` is deliberately **not** ignored — Shopify's GitHub
  integration commits theme-editor changes back to the branch.
- `.shopifyignore` keeps `frontend/`, tooling and docs out of theme uploads. Only
  `assets/` and the Liquid directories ship.

## CI

`.github/workflows/build.yml` runs `type-check`, `lint`, `check:boundary` and
`build`. On a push it commits the rebuilt assets back to the branch; on a pull
request it fails if the committed assets differ from a fresh build. Either way, a
stale `assets/` is caught — but do not pre-empt it by building locally unless
asked.

## Subagents

Defined in [.claude/agents/](.claude/agents/). Claude routes to them by task, or
name one explicitly.

| Agent | Use for |
|-------|---------|
| `ui-design` | Component styling, responsive layout, design tokens, animation |
| `liquid` | Sections, blocks, schemas, metafields, Ajax API, avoiding N+1 loops |
| `code-writer` | TypeScript components, Liquid templates, feature implementation |
| `accessibility` | Keyboard navigation, focus management, ARIA, WCAG 2.1 AA |
| `performance` | Core Web Vitals, image and script loading, critical CSS |
| `tailwind` | Only if Tailwind is ever adopted — it is not today |

## Resources

- [Shopify Theme Development](https://shopify.dev/docs/themes)
- [Shopify Liquid Reference](https://shopify.dev/docs/api/liquid)
- [Vite](https://vitejs.dev/) · [vite-plugin-shopify](https://github.com/barrel/shopify-vite)
