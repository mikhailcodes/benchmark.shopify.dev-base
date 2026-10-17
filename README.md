# Shopify theme generator

Scaffolds a Horizon-based Shopify theme with the house frontend layer: Vite,
TypeScript, SCSS tokens, self-mounting custom elements, and Liquid Ajax Cart
owning the cart.

```bash
cd ~/Developer/my-new-theme
bun ~/Developer/benchmark.shopify.dev-base/setup.ts
```

Add `--yes` to accept every default without prompting.

## What it asks

| Question | Default | Effect |
|----------|---------|--------|
| Project name | directory name | `package.json` name |
| Namespace prefix | first word of the project name | every custom tag and Liquid file — `kula-header`, `KulaElement`, `window.kula` |
| Base theme source | clone latest Horizon from GitHub | also: clone at a ref, `shopify theme pull` from a store, or keep what is already there |
| Cart owner | Liquid Ajax Cart | the alternative skips the cart layer, its guard, its CI step and flags the docs |
| Deploy | GitHub integration owns the live theme | the alternative is CLI push only |
| Credentials | skip | writes the gitignored `shopify.theme.toml` |
| Install and verify | yes | `yarn install`, then type-check, lint, boundary, build |
| Install Benchmark tooling | yes | installs the `benchmark-tools` and `mattpocock-skills` Claude Code plugins when missing; `"installTooling": false` in a config file skips it |

## Project workflow

Every generated theme gets `docs/agents/project.md`, a draft profile that the
[benchmark-tools](https://github.com/benchmarkcommerce/benchmark-tools) plugin reads
for tracker, branches, gates and reviewer. Setup checks the plugin is installed and
offers to install it. Then, in Claude Code:

```
/kickoff setup   # finish the profile: ClickUp list, statuses, reviewers
/kickoff new     # brief, wayfinder decisions, kickoff tickets
```

It then records the `shopify theme check` baseline into `.claude/CLAUDE.md`, and
offers a commit per stage: pristine Horizon first, the layer second. That split is
what makes a future Horizon upgrade a readable diff.

## What it produces

```
assets/ blocks/ config/ layout/ locales/ sections/ snippets/ templates/   Horizon
sections/<ns>-*.liquid  snippets/<ns>-*.liquid                            ours
frontend/entrypoints/   storefront.ts, custom_styling.scss
frontend/modules/       core, elements, sections, utils, constants, types
frontend/styles/        tokens, base, utils, components
tools/                  clean-assets, check-horizon-boundary
CLAUDE.md  .claude/CLAUDE.md  frontend/CLAUDE.md  frontend/styles/DESIGN.md
```

Six stock Horizon files take additive patches and three are deleted, all on the
cart path. `setup.ts` applies them by anchor and **reports every patch that did not
apply** rather than failing silently — Horizon moves that markup between versions.
The generated `.claude/CLAUDE.md` lists all nine files with the reason each one is
unavoidable.

## Editing the layer

Everything the generator writes is a real file in [template/](template/), not a
string literal in `setup.ts`. Change the layer by changing those files.

Substitution happens on file contents and on paths:

| Token | Becomes |
|-------|---------|
| `__NS__` | the namespace (`kula`) |
| `__NS_TITLE__` | capitalised (`Kula`) — `__NS_TITLE__Element`, `__NS__Settings` |
| `__PACKAGE__` | the package name |
| `__HORIZON_VERSION__`, `__HORIZON_SHA__` | what was actually pulled |
| `__THEME_CHECK_BASELINE__` | what theme check actually measured |

Dotfiles are stored with a leading underscore (`_gitignore`, `_claude/`,
`_github/`) so they stay inert in this repository; `setup.ts` maps them back.

`setup.ts` holds only the orchestration: prompts, Horizon acquisition, the
substituting copy, the core-file patches, and the verification run.

## Keeping it current

After a Horizon release, re-run the generator into a scratch directory. A patch
that no longer applies prints a named failure — fix the anchor in `setup.ts`, not
in the generated project.
