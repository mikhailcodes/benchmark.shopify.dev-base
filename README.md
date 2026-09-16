# Secure Shopify Development Workflow with Vite

A production-ready, security-focused Shopify theme development environment utilizing Vite for modern asset bundling, Yarn 4 for deterministic dependency management, and automated CI/CD workflows.

## Table of Contents

- [Overview](#overview)
- [Security & Privacy Considerations](#security--privacy-considerations)
- [Architecture & Performance](#architecture--performance)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [CI/CD Pipeline](#cicd-pipeline)
- [Performance Optimizations](#performance-optimizations)

---

## Overview

This development environment is designed to work seamlessly with **coding agents** (like Claude, GitHub Copilot, or Cursor) to provide a structured, secure, and performant Shopify theme development workflow.

### Key Features

- **Security-First**: No PII or client data exposure, comprehensive .gitignore and .shopifyignore configurations
- **Modern Tooling**: Vite for lightning-fast HMR and optimized builds
- **Deterministic installs**: Yarn 4 with an immutable lockfile, pinned via `packageManager`
- **Agent-Friendly**: Structured guidelines in `project_setup.md` for consistent AI-assisted development
- **Production Ready**: Automated builds, testing, and deployment workflows
- **Framework Agnostic**: Vanilla JS by default, easily extensible to TypeScript, React, Vue, etc.

### Purpose

This setup serves three primary purposes:

1. **Standardize Development**: Provide a consistent, repeatable setup process across all Shopify projects
2. **Enable AI Collaboration**: Structured instructions allow coding agents to understand project architecture and conventions
3. **Enforce Best Practices**: Built-in security, performance, and code quality standards

---

## Security & Privacy Considerations

### Data Protection

**No client or customer data is stored in this repository.** All security measures are designed to prevent accidental exposure of sensitive information:

#### 1. Environment Variables (.gitignore)
```gitignore
.env
.env.local
.env.*.local
```
- All environment files are excluded from version control
- API keys, store credentials, and access tokens must be stored in `.env` files
- Never commit configuration files containing store URLs or credentials

#### 2. Shopify Configuration (.gitignore)
```gitignore
config/settings_data.json
shopify.theme.toml
```
- `settings_data.json` may contain store-specific settings and is excluded
- `shopify.theme.toml` contains store connection details and is excluded
- Theme customizations in the Shopify admin are not tracked

#### 3. Source Code Protection (.shopifyignore)
```shopifyignore
frontend/
*.md
.github/
vite.config.js
package.json
```
- Source code and development files are never uploaded to Shopify
- Only compiled assets in `assets/` directory are deployed
- Documentation and configuration files remain local

#### 4. Build Artifact Security

- **Compiled Assets Only**: Shopify receives only minified, compiled JavaScript and CSS
- **No Source Maps in Production**: Source maps are development-only (configurable in `vite.config.js`)
- **Dependency Isolation**: `node_modules` never uploaded to Shopify servers

### Security Best Practices

1. **Store Credentials**: Use Shopify CLI environment switching (`--environment development/staging/production`)
2. **Access Control**: Utilize Shopify's staff permissions and custom app scopes
3. **Code Review**: GitHub Actions workflow validates builds before deployment
4. **Audit Trail**: Git history tracks all changes with commit messages

---

## Architecture & Performance

### Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Build Tool** | Vite 5.x | Sub-second HMR, optimized production builds, native ESM support |
| **Runtime** | Node 22 | Matches the CI runner; Corepack activates the pinned Yarn |
| **Package Manager** | Yarn 4 (Berry) | Immutable lockfile, `nodeLinker: node-modules` so the Shopify CLI can spawn binaries |
| **Language** | TypeScript 5 | `strict`, `verbatimModuleSyntax`, type-checked in CI |
| **Asset Pipeline** | vite-plugin-shopify | Seamless integration with Shopify theme structure |
| **CSS Processing** | PostCSS + Autoprefixer | Cross-browser compatibility, modern CSS features |
| **Bundling** | Rollup (via Vite) | Tree-shaking, code-splitting, optimized chunks |

### Performance Choices

#### 1. Vite Over Webpack

**Why Vite?**
- **Development Speed**: Hot Module Replacement (HMR) in <50ms vs Webpack's 1-5s
- **Build Performance**: esbuild-powered transforms (10-100x faster than Babel)
- **Native ESM**: Leverages browser-native module loading
- **On-Demand Compilation**: Only compiles imported modules during development

**Benchmark Comparison**:
```
Development Server Start:
- Webpack: 5-15 seconds
- Vite: 200-500ms

HMR Update:
- Webpack: 1-5 seconds
- Vite: 20-100ms
```

#### 2. Yarn 4 Over npm

**Why Yarn 4?**
- **Reproducible CI**: `yarn install --immutable` fails rather than silently
  resolving a different tree
- **Pinned toolchain**: `packageManager` in package.json plus Corepack means the
  runner and a laptop use the identical Yarn version
- **Fast, shared cache**: `enableGlobalCache` keeps installs cheap across branches

**`nodeLinker: node-modules` is deliberate.** Yarn PnP breaks both the Shopify
CLI and vite-plugin-shopify, which resolve and spawn binaries from a real
`node_modules` tree.

#### 3. Build Configuration Decisions

##### File Naming Strategy (`vite.config.js`)
```javascript
output: {
  entryFileNames: '[name].js',
  assetFileNames: '[name][extname]',
  chunkFileNames: '[name].js',
}
```

**Rationale**:
- **Predictable URLs**: Shopify Liquid templates require stable asset paths
- **Cache Control**: Shopify handles cache-busting via theme version
- **Debugging**: Human-readable filenames in browser DevTools
- **Simplicity**: No hash management in Liquid templates

##### Empty Output Directory: `false`
```javascript
build: {
  emptyOutDir: false,
}
```

**Rationale**:
- **Preserves Shopify Assets**: Existing theme assets (fonts, images) not managed by Vite remain intact
- **Incremental Builds**: Only updates changed files
- **Safety**: Prevents accidental deletion of manually uploaded assets

##### CORS Configuration
```javascript
server: {
  headers: {
    "Access-Control-Allow-Origin": "*",
  },
  cors: {
    origin: ["*"],
    credentials: true,
  }
}
```

**Rationale**:
- **Local Development**: Allows Shopify preview to load Vite dev server assets
- **Hot Reload**: Enables WebSocket connections for HMR
- **Cross-Origin**: Shopify preview runs on different domain than localhost

---

## Quick Start

### Automated Setup (Recommended)

The setup script handles the entire configuration process:

```bash
bun setup.ts
```

**The script will**:
1. Ask configuration questions (store name, styling approach, environment)
2. Pull selected Shopify theme as base
3. Install all dependencies
4. Create project structure
5. Generate configuration files
6. Run initial build
7. Initialize Git repository

### Manual Setup

If you prefer manual setup or need to understand the process:

```bash
# 1. Activate the pinned Yarn
corepack enable

# 2. Install dependencies
yarn install

# 3. Create directory structure
mkdir -p frontend/entrypoints frontend/scripts frontend/styles

# 4. Create configuration files (see project_setup.md)
# - vite.config.js
# - postcss.config.js
# - package.json scripts

# 5. Build assets
yarn build

# 6. Start development
yarn dev
```

For detailed manual setup instructions, see [`project_setup.md`](./project_setup.md).

---

## Project Structure

### Directory Organization

```
shopify-theme/
├── .github/
│   └── workflows/
│       └── build.yml              # CI/CD pipeline
├── frontend/                      # 🔹 ALL CUSTOM CODE HERE
│   ├── entrypoints/
│   │   ├── storefront.js         # Main JavaScript entry
│   │   └── custom_styling.css    # Main CSS entry
│   ├── scripts/
│   │   ├── components/           # Reusable UI components
│   │   ├── sections/             # Section-specific logic
│   │   ├── hooks/                # Utilities & lifecycle hooks
│   │   └── utils.js              # Helper functions
│   ├── styles/                   # Component-specific CSS
│   ├── images/                   # Source images (optimized on build)
│   └── fonts/                    # Web fonts
├── assets/                        # 🔸 COMPILED OUTPUT (auto-generated)
│   ├── storefront.js             # Built from frontend/entrypoints/storefront.js
│   └── custom_styling.css        # Built from frontend/entrypoints/custom_styling.css
├── config/                        # Shopify theme settings
├── layout/                        # Shopify layout templates
├── sections/                      # Shopify sections
├── snippets/                      # Shopify snippets
│   └── vite-tag.liquid           # Auto-generated by vite-plugin-shopify
├── templates/                     # Shopify templates
├── .gitignore                     # Version control exclusions
├── .shopifyignore                 # Shopify upload exclusions
├── vite.config.js                 # Vite build configuration
├── postcss.config.js              # CSS processing configuration
├── package.json                   # Dependencies and scripts
├── CLAUDE.md                      # Project-specific AI guidelines
└── project_setup.md               # This setup guide
```

### Key Principles

1. **Source Code Location**: ALL custom CSS and JavaScript MUST be created in `frontend/`, never directly in `assets/`
2. **Build Output**: Vite compiles `frontend/` → `assets/`
3. **Shopify Upload**: Only `assets/`, `config/`, `layout/`, `sections/`, `snippets/`, `templates/` are uploaded
4. **Version Control**: Source code (`frontend/`) and build output (`assets/`) both tracked for CI/CD

---

## Development Workflow

### Daily Development

```bash
# Start development server (Vite + Shopify CLI)
yarn dev

# Quality gates
yarn type-check
yarn lint

# Build for production
yarn build

# Deploy — writes to the LIVE theme, never run unprompted
yarn deploy
```

### Environment Management

The setup supports multiple Shopify environments:

```json
{
  "scripts": {
    "dev": "run-s -s \"clean\" \"dev:serve\" --",
    "dev:serve": "run-p -sr \"shopify:dev\" \"vite:dev\" --",
    "shopify:dev": "shopify theme dev --environment development --live-reload=hot-reload"
  }
}
```

Environments live in `shopify.theme.toml`. Today only `development` exists, and
it points at the **live** theme.

**Environment configuration in Shopify CLI**:
```bash
# First time setup
shopify theme dev --environment development --store your-store.myshopify.com

# Subsequent runs
yarn dev  # Uses saved environment
```

### Hot Module Replacement (HMR)

Vite provides instant feedback during development:

1. **Edit CSS**: Changes appear immediately without page reload
2. **Edit JavaScript**: Module hot-swaps while preserving state
3. **Edit Liquid**: Shopify CLI reloads the preview

### Build Process

```bash
yarn build
```

**What happens**:
1. Vite reads `frontend/entrypoints/*.{js,css}`
2. Resolves all imports and dependencies
3. Transpiles modern JavaScript (ES2020+) → ES2015
4. Processes CSS (autoprefixer, minification)
5. Tree-shakes unused code
6. Outputs to `assets/` directory
7. Generates `snippets/vite-tag.liquid` with asset references

**Output files**:
- `assets/storefront.js` (minified, optimized)
- `assets/custom_styling.css` (autoprefixed, minified)

---

## Coding Standards

### CSS Guidelines

#### 1. Mobile-First Responsive Design

Always start with mobile styles, then use `@media` queries for larger screens:

```css
/* ✅ CORRECT: Mobile-first */
.product-card {
  padding: 1rem;                    /* Mobile */
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .product-card {
    padding: 1.5rem;                /* Tablet */
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 1024px) {
  .product-card {
    padding: 2rem;                  /* Desktop */
    grid-template-columns: repeat(3, 1fr);
  }
}

/* ❌ WRONG: Desktop-first */
.product-card {
  padding: 2rem;
}

@media (max-width: 768px) {
  .product-card {
    padding: 1rem;
  }
}
```

**Rationale**:
- **Performance**: Mobile users download only mobile styles, not desktop overrides
- **Progressive Enhancement**: Start with functional minimum, enhance for larger screens
- **Maintainability**: Easier to reason about breakpoint logic

#### 2. Semantic Class Names (NO Utility Classes)

Use descriptive class names that convey purpose, not appearance:

```css
/* ✅ CORRECT: Semantic class names */
.product-card {
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface);
  border-radius: var(--border-radius);
}

.product-card__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.product-card__price {
  font-size: 1.125rem;
  color: var(--color-accent);
}

/* ❌ WRONG: Utility-based classes */
.flex.flex-col.bg-white.rounded-lg {
  /* This is Tailwind-style - NOT allowed */
}
```

**Rationale**:
- **Readability**: Code reviewers understand intent without reading CSS
- **Maintainability**: Changing appearance doesn't require template updates
- **Consistency**: Team follows same naming patterns (BEM-style recommended)

#### 3. CSS Custom Properties (Variables)

Leverage CSS variables for theming and consistency:

```css
:root {
  /* Colors */
  --color-primary: rgb(var(--color-button));
  --color-secondary: rgb(var(--color-accent));
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666;
  --color-surface: #ffffff;
  --color-border: #e5e5e5;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-base: 1rem;
  --spacing-lg: 2rem;
  --spacing-xl: 4rem;

  /* Typography */
  --font-heading: 'Helvetica Neue', Arial, sans-serif;
  --font-body: 'Georgia', serif;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;

  /* Borders */
  --border-radius: 4px;
  --border-width: 1px;
}

.button-primary {
  background-color: var(--color-primary);
  color: var(--color-surface);
  padding: var(--spacing-sm) var(--spacing-base);
  border-radius: var(--border-radius);
  transition: background-color var(--transition-base);
}

.button-primary:hover {
  background-color: color-mix(in srgb, var(--color-primary) 90%, black);
}
```

**Rationale**:
- **Theming**: Change entire color scheme by updating variables
- **Consistency**: Design tokens enforced across components
- **Performance**: Browser-native, no JavaScript required

### JavaScript Guidelines

#### 1. Naming Conventions

Use **camelCase** for all JavaScript functions and variables:

```javascript
// ✅ CORRECT
function initProductForm() {
  const addToCartButton = document.querySelector('.add-to-cart');
  const formElement = document.getElementById('product-form');

  addToCartButton.addEventListener('click', handleAddToCart);
}

function handleAddToCart(event) {
  event.preventDefault();
  // ...
}

// ❌ WRONG
function init_product_form() {
  const add_to_cart_button = document.querySelector('.add-to-cart');
}

function handle-add-to-cart(event) {
  // Invalid syntax
}
```

**Class names**: PascalCase
```javascript
class ProductCard {
  constructor(element) {
    this.element = element;
  }
}
```

#### 2. ES Modules and Imports

TypeScript with ES modules. Two aliases, declared in both `vite.config.js` and
`tsconfig.json`:

```typescript
// ✅ CORRECT: @ for frontend/scripts, ~ for anything else under frontend/
import { consoleMessage, defineElement, parseElementConfig } from '@/utils';
import type { StorefrontGlobal } from '@/types';

// ✅ CORRECT: a section's .types.ts companion is a sibling
import type { MbCarouselConfig } from './mb-carousel.types';

// ❌ WRONG: CommonJS is not supported by Vite
const utils = require('./utils');
```

Type-only imports must use `import type` — `verbatimModuleSyntax` is enabled.

#### 3. Component Architecture: the tag is the initiator

Every custom section is a custom element. The tag in the Liquid markup boots the
behaviour — there is no registry, no boot loop, no `querySelectorAll` pass. The
browser upgrades the element and calls `connectedCallback()`.

```typescript
// frontend/scripts/components/sections/mb-cart-drawer.types.ts
export type MbCartDrawerConfig = {
  readonly close_on_escape: boolean;
};
```

```typescript
// frontend/scripts/components/sections/mb-cart-drawer.ts
import { consoleMessage, defineElement, parseElementConfig } from '@/utils';
import type { MbCartDrawerConfig } from './mb-cart-drawer.types';

const DEFAULT_CONFIG: MbCartDrawerConfig = { close_on_escape: true };

export class MbCartDrawer extends HTMLElement {
  private controller: AbortController | null = null;
  private config: MbCartDrawerConfig = DEFAULT_CONFIG;
  private panel: HTMLElement | null = null;
  private isInitialized = false;

  connectedCallback(): void {
    if (this.isInitialized) return;

    this.panel = this.querySelector('.mb-cart-drawer__panel');

    if (!this.panel) {
      consoleMessage('MbCartDrawer: missing panel', 'warn');
      return;
    }

    this.config = parseElementConfig(this, DEFAULT_CONFIG);
    this.controller = new AbortController();

    const { signal } = this.controller;
    this.addEventListener('click', this.handleClick, { signal });

    if (this.config.close_on_escape) {
      document.addEventListener('keydown', this.handleKeydown, { signal });
    }

    this.isInitialized = true;
  }

  disconnectedCallback(): void {
    this.controller?.abort();
    this.controller = null;
    this.panel = null;
    this.isInitialized = false;
  }

  private handleClick = (event: Event): void => {
    const _toggle = (event.target as HTMLElement | null)?.closest('[data-cart-toggle]');
    if (!_toggle) return;

    this.classList.toggle('is-open');
  };

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;

    this.classList.remove('is-open');
  };
}

defineElement('mb-cart-drawer', MbCartDrawer);
```

One `AbortController` owns every listener, so `disconnectedCallback()` releases
them all at once and can never drift out of sync with the bind sites.

Register it by adding one line to `frontend/scripts/components/sections/index.ts`:

```typescript
import './mb-cart-drawer';
```

#### 4. Theme Editor Lifecycle

Section load and unload need no code. A setting change re-renders the section
HTML, which destroys the old element and constructs a new one — the element
lifecycle already covers it. The same is true of markup fetched through the
Section Rendering API.

Block select and deselect are the exception: they fire without re-rendering
anything. The events bubble from the block up through the section root, so the
element listens on itself:

```typescript
this.addEventListener('shopify:block:select', this.handleBlockSelect, { signal });
```

```typescript
private handleBlockSelect = (event: Event): void => {
  const _blockId = (event as ShopifyBlockEvent).detail.blockId;
  this.scrollToBlock(_blockId);
};
```

**Rationale**:
- **Fewer moving parts**: the tag name is the single source of truth — no
  `data-section-type`, no registry map to keep in sync
- **Memory management**: one `AbortController` per element, aborted on disconnect
- **Works everywhere**: AJAX-inserted markup boots identically to server-rendered

---

## CI/CD Pipeline

### GitHub Actions Workflow

The `.github/workflows/build.yml` ensures code quality:

```yaml
name: Build Vite Assets

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      # Corepack must run before any yarn call.
      - run: corepack enable

      - run: yarn install --immutable
      - run: yarn type-check
      - run: yarn lint
      - run: yarn build

      - name: Verify assets are in sync (PR)
        if: github.event_name == 'pull_request'
        run: git diff --exit-code assets/ snippets/vite-tag.liquid

      - name: Upload assets artifact
        uses: actions/upload-artifact@v4
        with:
          name: built-assets
          path: assets/
```

### Workflow Logic

1. **Trigger**: Runs on every push/PR to `main` or `develop`
2. **Environment**: Node 22 on the Ubuntu runner, Yarn activated through Corepack
3. **Install**: Fetches all dependencies from `package.json`
4. **Build**: Compiles `frontend/` → `assets/`
5. **Validation**: Fails if built assets differ from committed assets
6. **Artifact**: Uploads built assets for inspection

### Why Commit Built Assets?

**This workflow requires built assets in version control**:

```bash
# After making changes
yarn build
git add assets/
git commit -m "chore(assets): compile theme assets"
git push
```

**Rationale**:
1. **Deployment Safety**: Ensures production assets are reviewed in PR
2. **Rollback**: Git history preserves working builds
3. **Shopify Upload**: `shopify theme push` uploads from git-tracked files
4. **CI Validation**: Prevents "works on my machine" build issues

---

## Performance Optimizations

### 1. Asset Loading Strategy

**Critical CSS Inlining** (optional):
```liquid
{%- comment -%} In layout/theme.liquid {%- endcomment -%}
<style>
  /* Inline critical above-the-fold CSS here */
  .header { display: flex; }
  .hero { min-height: 60vh; }
</style>

{% render 'vite-tag' with 'custom_styling.css' %}
```

**Async JavaScript**:
```liquid
{% render 'vite-tag' with 'storefront.js', type: 'script', async: true %}
```

### 2. Code Splitting

Vite automatically splits vendor code:

```javascript
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        // Split large libraries into separate chunks
        'vendor': ['lodash', 'axios'],
      }
    }
  }
}
```

### 3. Image Optimization

**Important**: Do NOT use Vite plugins for image optimization in Shopify themes. Shopify has built-in image optimization via the `image_url` filter with automatic CDN delivery, resizing, and format conversion.

Use Shopify's native image optimization in Liquid templates:

```liquid
{%- comment -%} Shopify's built-in image optimization {%- endcomment -%}
<img
  srcset="{{ product.featured_image | image_url: width: 375 }} 375w,
          {{ product.featured_image | image_url: width: 750 }} 750w,
          {{ product.featured_image | image_url: width: 1100 }} 1100w"
  sizes="(min-width: 750px) 50vw, 100vw"
  src="{{ product.featured_image | image_url: width: 750 }}"
  alt="{{ product.featured_image.alt | escape }}"
  loading="lazy"
  width="{{ product.featured_image.width }}"
  height="{{ product.featured_image.height }}"
>
```

**Benefits of Shopify's image optimization**:
- Automatic WebP/AVIF format conversion
- Global CDN delivery
- On-demand resizing
- No build-time processing needed

### 4. Web Vitals Monitoring

Built-in performance tracking:

```javascript
// frontend/scripts/utils.js
export function reportWebVitals() {
  if ('PerformanceObserver' in window) {
    // Largest Contentful Paint
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        console.log('FID:', entry.processingStart - entry.startTime);
      });
    }).observe({ entryTypes: ['first-input'] });
  }
}
```

---

## Working with Coding Agents

### Instructions for AI Assistants

This project is optimized for AI-assisted development. When working with coding agents:

#### 1. Always Reference Project Guidelines

**Before making changes**, agents should:
1. Read `CLAUDE.md` for project-specific conventions
2. Review `project_setup.md` for architecture understanding
3. Check `package.json` scripts for available commands

#### 2. Follow File Creation Rules

```bash
# ✅ CORRECT: Create files in frontend/
frontend/scripts/components/productQuickView.js
frontend/styles/product-quick-view.css

# ❌ WRONG: Create files directly in assets/
assets/product-quick-view.js  # This will be overwritten on build!
```

#### 3. Use Semantic Commit Messages

```bash
# ✅ CORRECT
git commit -m "feat: Add product quick view component"
git commit -m "fix: Resolve cart drawer closing issue"
git commit -m "perf: Optimize image loading with lazy loading"
git commit -m "docs: Update component usage in README"

# ❌ WRONG
git commit -m "updates"
git commit -m "fixed stuff"
```

#### 4. Coding Agent Checklist

When an AI agent creates a new component:

- [ ] Create `.js` file in `frontend/scripts/components/` or `frontend/scripts/sections/`
- [ ] Create `.css` file in `frontend/styles/`
- [ ] Import CSS in `frontend/entrypoints/custom_styling.css`
- [ ] Import JS in `frontend/entrypoints/storefront.js` or use dynamic imports
- [ ] Use `camelCase` for JavaScript, `kebab-case` for CSS classes
- [ ] Follow mobile-first responsive design
- [ ] Add JSDoc comments for functions
- [ ] Test in Shopify theme editor (section lifecycle)
- [ ] Build assets (`yarn build`)
- [ ] Commit built assets with source code

---

## Troubleshooting

### Common Issues

#### Issue: "Cannot find module '~/scripts/utils'"

**Cause**: Vite alias not configured correctly

**Solution**:
```javascript
// vite.config.js
import { fileURLToPath, URL } from 'node:url';

resolve: {
  alias: {
    '~': fileURLToPath(new URL('./frontend', import.meta.url)),
  },
}
```

#### Issue: Assets not updating in Shopify preview

**Cause**: Browser caching or Vite dev server not connected

**Solution**:
1. Check `snippets/vite-tag.liquid` is included in `layout/theme.liquid`
2. Verify Vite dev server is running on http://localhost:5173
3. Clear browser cache (Cmd+Shift+R / Ctrl+Shift+F5)
4. Check browser console for CORS errors

#### Issue: CORS errors and assets failing to load in Shopify Theme Editor

**Problem**: Vite dev server assets fail to load in Shopify theme editor due to CORS errors and mixed content blocking (HTTPS → HTTP).

**Root Cause**:
- Shopify theme editor runs on HTTPS
- Local Vite dev server runs on HTTP (localhost:5173)
- Browsers block mixed content (HTTPS page loading HTTP resources)
- Vite 6.0.9+ has a bug where `allowedHosts: 'all'` doesn't work properly

**Solution: Use Cloudflare Tunnel**

This is the most reliable approach for theme editor development:

1. **Install cloudflared** (one-time setup):
   ```bash
   brew install cloudflared
   ```

2. **Enable tunnel in vite.config.js**:
   ```javascript
   // vite.config.js
   import shopify from 'vite-plugin-shopify';

   export default defineConfig({
     plugins: [
       shopify({
         themeRoot: './',
         sourceCodeDir: 'frontend',
         entrypointsDir: 'frontend/entrypoints',
         tunnel: true, // Enable Cloudflare tunnel
       }),
     ],
     server: {
       allowedHosts: 'all', // Allow tunnel requests
       headers: {
         "Access-Control-Allow-Origin": "*",
         "Access-Control-Allow-Methods": "GET, HEAD, PUT, POST, PATCH, DELETE",
         "Access-Control-Allow-Headers": "Content-Type, Authorization",
         "Access-Control-Allow-Credentials": "true"
       },
       cors: {
         origin: "*",
         credentials: true
       }
     }
   });
   ```

3. **Important: Downgrade Vite to 6.0.8** (critical for tunnel support):
   ```bash
   yarn add -D vite@6.0.8
   ```

   **Why?** Vite versions 6.0.9+ and 7.x have a bug where `allowedHosts: 'all'` doesn't work, causing the tunnel to return "Invalid Host header" errors. Version 6.0.8 is the last stable version for tunnel-based development.

4. **Restart dev server**:
   ```bash
   yarn dev
   ```

**How it works**:
- `vite-plugin-shopify` automatically starts a Cloudflare tunnel when `tunnel: true`
- Creates a public HTTPS URL (e.g., `https://random-name.trycloudflare.com`)
- Routes requests through tunnel → your local Vite server
- Shopify theme editor loads assets via HTTPS tunnel URL
- No mixed content errors, no CORS issues

**Alternative: HTTPS with mkcert (without tunnel)**

If you prefer not to use tunneling:

1. Install mkcert and create local certificates:
   ```bash
   brew install mkcert
   mkcert -install
   mkcert localhost
   ```

2. Configure Vite for HTTPS:
   ```javascript
   // vite.config.js
   import { readFileSync } from 'fs';

   export default defineConfig({
     server: {
       https: {
         key: readFileSync('./localhost-key.pem'),
         cert: readFileSync('./localhost.pem'),
       },
       cors: {
         origin: "*",
         credentials: true
       }
     }
   });
   ```

**Note**: The tunnel approach is simpler and more reliable for most use cases.

#### Issue: Build fails in GitHub Actions

**Cause**: Uncommitted built assets

**Solution**:
```bash
yarn build
git add assets/
git commit -m "build: update compiled assets"
git push
```

#### Issue: Section not working in theme editor

**Cause**: The section module was never imported, so its tag was never defined.

**Solution**: Add it to the barrel — that import is the only thing that registers
a section:
```typescript
// frontend/scripts/components/sections/index.ts
import './mb-my-section';
```

If the tag is defined and the section still misbehaves after a settings change,
the element is holding state across reconnects. `disconnectedCallback()` must
reset `isInitialized` and abort the controller.

---

## Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [vite-plugin-shopify Documentation](https://github.com/barrel/shopify-vite)
- [Shopify Theme Development](https://shopify.dev/docs/themes)
- [Custom Elements — MDN](https://developer.mozilla.org/docs/Web/API/Web_components/Using_custom_elements)
- [Shopify CLI Documentation](https://shopify.dev/docs/themes/tools/cli)

---

## License

This setup template is provided as-is for development purposes. Individual Shopify themes may have their own licenses.

## Maintainer

**Mikhail Arden**
Version: 1.0.0
Last Updated: October 2025

---

## Summary

This Shopify development environment provides:

✅ **Security**: Comprehensive .gitignore, environment variable protection, no PII exposure
✅ **Performance**: Vite HMR (<50ms), Yarn 4 immutable installs, optimized builds
✅ **Developer Experience**: Hot reload, type-safe imports, structured architecture
✅ **AI-Friendly**: Clear guidelines for coding agents, consistent conventions
✅ **Production-Ready**: CI/CD pipeline, automated testing, deployment scripts
✅ **Best Practices**: Mobile-first CSS, semantic class names, ES modules, section lifecycles

**Start developing**:
```bash
bun setup.ts  # Automated setup — the scaffolder itself runs on Bun
yarn dev      # Start development
```
