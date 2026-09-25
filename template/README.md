# __NS_TITLE__ — Shopify theme

A Horizon __HORIZON_VERSION__ theme with a Vite-compiled `frontend/` layer. Custom sections are
custom elements that mount themselves; the cart is owned by Liquid Ajax Cart.

## Requirements

- Node 20+
- Yarn 4 (via `corepack enable` — the version is pinned in `package.json`)
- Shopify CLI 3.x

## Setup

```bash
corepack enable
yarn install
cp example.shopify.theme.toml shopify.theme.toml   # then fill in store, theme id, token
yarn dev
```

`yarn dev` starts the Shopify CLI preview on 9292 and Vite on 5173. Both honour
`SHOPIFY_PORT` / `VITE_PORT` when another theme project holds the defaults.

## Commands

| Command | Does |
|---------|------|
| `yarn dev` | Vite + Shopify CLI against the development theme, hot reload |
| `yarn build` | Compile `frontend/` into `assets/` |
| `yarn type-check` | `tsc --noEmit` |
| `yarn lint` | `eslint frontend` |
| `yarn check:boundary` | Verify the __NS_TITLE__/Horizon cart contract still holds |
| `yarn push` / `yarn pull` | Sync the unpublished development theme |
| `shopify theme check` | Compare against the recorded baseline (9 offenses, all stock Horizon) |

Never run `yarn build` or `yarn push` unprompted — CI compiles assets, and push
writes to a real theme.

## Layout

```
sections/__NS__-*.liquid     custom sections          sections/*.liquid     Horizon's
snippets/__NS__-*.liquid     custom snippets          snippets/*.liquid     Horizon's
blocks/__NS__-*.liquid       custom blocks            blocks/*.liquid       Horizon's

frontend/
  entrypoints/    storefront.ts, custom_styling.scss
  modules/        core, elements, sections, utils, constants, types   (`@` alias)
  styles/         tokens, base, utils, components                     (design system)

assets/           compiled output — never edited by hand
tools/            clean-assets, check-horizon-boundary
```

Everything __NS_TITLE__ owns carries the `__NS__-` prefix, so a Horizon upgrade is
"overwrite every unprefixed file, keep what survives".

## Base theme

Horizon **__HORIZON_VERSION__**, seeded from [`Shopify/horizon`](https://github.com/Shopify/horizon)
at `__HORIZON_SHA__`. The baseline commit in this repository's history is unmodified Horizon, so a
diff against it is exactly the __NS_TITLE__ layer.

Six stock files carry additive edits and three are deleted — all of them on the
cart path, all listed in [.claude/CLAUDE.md](.claude/CLAUDE.md#the-namespace-rule).
Re-run `yarn check:boundary` first thing after any upgrade: it catches the edits an
upgrade silently reverted.

## Status

- Base theme, build toolchain, custom-element layer, cart architecture and docs: **done**.
- Design tokens: **placeholder values** inherited with the ported layer. Re-point
  them from the __NS_TITLE__ Figma frames — see [frontend/styles/DESIGN.md](frontend/styles/DESIGN.md).
- Templates, header and footer: **stock Horizon**, to be built from the frames.

## Documentation

| Read | For |
|------|-----|
| [CLAUDE.md](CLAUDE.md) | Orientation and commands |
| [.claude/CLAUDE.md](.claude/CLAUDE.md) | Project rules, namespacing, environments, review standards |
| [frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md) | Why the module layout is shaped this way |
| [frontend/CLAUDE.md](frontend/CLAUDE.md) | The custom-element pattern and SCSS helpers |
| [frontend/NEW_SECTION.md](frontend/NEW_SECTION.md) | Building a section from a design frame |
| [frontend/styles/DESIGN.md](frontend/styles/DESIGN.md) | Tokens and component specs |
