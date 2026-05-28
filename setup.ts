#!/usr/bin/env bun
/**
 * Interactive Shopify Theme Development Setup Script
 *
 * Creates a modern Shopify theme development environment with:
 * - Vite + Bun build system
 * - Custom Elements with Section Registry
 * - TypeScript or Vanilla JS
 * - SCSS, CSS, or Tailwind (@apply pattern)
 * - Theme event scanner
 * - Specialized Claude agents
 */

import { $ } from 'bun';
import { readdir, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import * as readline from 'node:readline';

// =============================================================================
// TERMINAL COLORS & UTILITIES
// =============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message: string, color = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function header(message: string): void {
  console.log('\n' + '═'.repeat(60));
  log(message, colors.bright + colors.cyan);
  console.log('═'.repeat(60) + '\n');
}

function subheader(message: string): void {
  console.log('\n' + '─'.repeat(60));
  log(message, colors.bright + colors.blue);
  console.log('─'.repeat(60) + '\n');
}

const _rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((_resolve) => {
    _rl.question(`${colors.yellow}${question}${colors.reset} `, (_answer) => {
      _resolve(_answer.trim());
    });
  });
}

async function select(question: string, options: string[]): Promise<number> {
  log(question, colors.yellow);
  options.forEach((_option, _index) => {
    log(`  ${_index + 1}. ${_option}`, colors.cyan);
  });

  const _answer = await prompt(`Enter choice (1-${options.length}):`);
  const _choice = parseInt(_answer);

  if (_choice >= 1 && _choice <= options.length) {
    return _choice - 1;
  }

  log('Invalid choice. Please try again.', colors.red);
  return select(question, options);
}

// =============================================================================
// TYPES
// =============================================================================

interface SetupConfig {
  projectName: string;
  projectNameSafe: string; // For window object (no hyphens)
  stylingApproach: 'scss' | 'css' | 'tailwind';
  jsApproach: 'typescript' | 'vanilla';
  packageManager: 'bun' | 'yarn';
  storeUrl: string;
  storePassword: string;
  environmentName: string;
  themeId: string | null;
}

interface ThemeInfo {
  id: string;
  name: string;
  role: string;
}

interface ThemeScanResult {
  events: { name: string; file: string; line: number }[];
  customElements: { name: string; file: string }[];
  globalObjects: string[];
  pubsubPattern: boolean;
}

// =============================================================================
// SHOPIFY HELPERS
// =============================================================================

async function getShopifyThemes(storeUrl: string, password: string): Promise<ThemeInfo[]> {
  try {
    const _response = await fetch(
      `https://${storeUrl}/admin/api/2024-10/themes.json`,
      {
        headers: {
          'Authorization': `Basic ${btoa(`:${password}`)}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!_response.ok) {
      throw new Error(`HTTP ${_response.status}: ${_response.statusText}`);
    }

    const _data = await _response.json() as { themes: Array<{ id: number; name: string; role: string }> };
    return _data.themes.map((_t) => ({
      id: String(_t.id),
      name: _t.name,
      role: _t.role,
    }));
  } catch (_err) {
    log(`Failed to fetch themes: ${_err}`, colors.red);
    return [];
  }
}

function parseStoreUrl(input: string): string {
  // Handle: https://admin.shopify.com/store/my-store/themes → my-store.myshopify.com
  const _adminMatch = input.match(/admin\.shopify\.com\/store\/([^/]+)/);
  if (_adminMatch) return `${_adminMatch[1]}.myshopify.com`;

  // Handle: my-store → my-store.myshopify.com
  if (!input.includes('.myshopify.com')) return `${input.trim()}.myshopify.com`;

  return input.trim();
}

async function scanThemeForEvents(themePath: string): Promise<ThemeScanResult> {
  const _result: ThemeScanResult = {
    events: [],
    customElements: [],
    globalObjects: [],
    pubsubPattern: false,
  };

  const _eventPatterns = [
    'cart:add',
    'cart:update',
    'cart:updated',
    'cart:change',
    'cart:refresh',
    'variant:change',
    'variant:changed',
    'product:added',
    'product:loaded',
    'quickview:open',
    'quickview:close',
    'modal:open',
    'modal:close',
    'drawer:open',
    'drawer:close',
  ];

  const _assetsPath = join(themePath, 'assets');

  try {
    const _files = await readdir(_assetsPath);
    const _jsFiles = _files.filter(
      (_f) => _f.endsWith('.js') && !_f.includes('.min.')
    );

    for (const _file of _jsFiles) {
      const _content = await readFile(join(_assetsPath, _file), 'utf-8');
      const _lines = _content.split('\n');

      // Scan for event patterns
      _lines.forEach((_line, _index) => {
        for (const _pattern of _eventPatterns) {
          if (_line.includes(`'${_pattern}'`) || _line.includes(`"${_pattern}"`)) {
            _result.events.push({
              name: _pattern,
              file: _file,
              line: _index + 1,
            });
          }
        }

        // Check for customElements.define
        const _customElementMatch = _line.match(
          /customElements\.define\s*\(\s*['"]([^'"]+)['"]/
        );
        if (_customElementMatch) {
          _result.customElements.push({
            name: _customElementMatch[1],
            file: _file,
          });
        }

        // Check for PubSub pattern
        if (
          _line.includes('PubSub') ||
          _line.includes('pubsub') ||
          _line.includes('publish') ||
          _line.includes('subscribe')
        ) {
          _result.pubsubPattern = true;
        }
      });

      // Check for global objects
      if (_content.includes('window.theme')) {
        _result.globalObjects.push('window.theme');
      }
      if (_content.includes('window.Shopify')) {
        _result.globalObjects.push('window.Shopify');
      }
    }

    // Deduplicate
    _result.events = _result.events.filter(
      (_e, _i, _arr) => _arr.findIndex((_x) => _x.name === _e.name) === _i
    );
    _result.globalObjects = [...new Set(_result.globalObjects)];
  } catch {
    // Assets folder might not exist yet
  }

  return _result;
}

function displayThemeScanResults(scan: ThemeScanResult): void {
  subheader('Theme Event Analysis');

  if (scan.events.length > 0) {
    log('Found events:', colors.green);
    scan.events.forEach((_e) => {
      log(`  - ${_e.name} (${_e.file}:${_e.line})`, colors.cyan);
    });
  } else {
    log('No custom events found in theme JS', colors.yellow);
  }

  console.log();

  if (scan.customElements.length > 0) {
    log('Registered Custom Elements:', colors.green);
    scan.customElements.forEach((_e) => {
      log(`  - <${_e.name}> (${_e.file})`, colors.cyan);
    });
  }

  console.log();

  if (scan.globalObjects.length > 0) {
    log('Global Objects:', colors.green);
    scan.globalObjects.forEach((_o) => {
      log(`  - ${_o}`, colors.cyan);
    });
  }

  if (scan.pubsubPattern) {
    log('\nPubSub pattern detected - theme uses publish/subscribe events', colors.green);
  }

  // Recommendations
  const _missingEvents = [
    'cart:updated',
    'variant:change',
  ].filter((_e) => !scan.events.find((_x) => _x.name === _e));

  if (_missingEvents.length > 0) {
    log('\nRecommendations:', colors.yellow);
    _missingEvents.forEach((_e) => {
      log(`  - Consider dispatching '${_e}' event in your code`, colors.yellow);
    });
  }
}

// =============================================================================
// INTERACTIVE QUESTIONS
// =============================================================================

async function askQuestions(): Promise<SetupConfig> {
  header('Shopify Theme Development Setup');

  log('This script sets up a modern Shopify theme development environment.', colors.green);
  log('Custom Elements + Section Registry + Vite + Bun\n', colors.dim);

  // Question 1: Project Name
  const _projectName = await prompt('Project name (e.g., acme-store):');

  if (!_projectName || _projectName.trim() === '') {
    log('Project name is required.', colors.red);
    process.exit(1);
  }

  const _projectNameSafe = _projectName.replace(/-/g, '_').replace(/\s/g, '_').toLowerCase();

  // Question 2: Styling Approach
  subheader('Styling');
  log('All options use semantic class names (BEM-style), mobile-first.\n', colors.dim);

  const _stylingChoice = await select('Which styling approach?', [
    'SCSS (Recommended - tokens, mixins, nesting)',
    'Plain CSS (CSS custom properties only)',
    'Tailwind CSS (Using @apply in CSS files, NOT inline utilities)',
  ]);
  const _stylingMap: SetupConfig['stylingApproach'][] = ['scss', 'css', 'tailwind'];
  const _stylingApproach = _stylingMap[_stylingChoice];

  // Question 3: JavaScript Approach
  subheader('JavaScript');

  const _jsChoice = await select('Which JavaScript approach?', [
    'TypeScript (Recommended - type safety, better IDE support)',
    'Vanilla JavaScript',
  ]);
  const _jsApproach: SetupConfig['jsApproach'] = _jsChoice === 0 ? 'typescript' : 'vanilla';

  // Question 4: Package Manager
  subheader('Package Manager');

  const _pmChoice = await select('Which package manager?', [
    'Yarn (Recommended)',
    'Bun',
  ]);
  const _packageManager: SetupConfig['packageManager'] = _pmChoice === 0 ? 'yarn' : 'bun';

  // Question 5: Shopify Store Configuration
  subheader('Shopify Store Configuration');

  log('Creating shopify.theme.toml for store credentials.\n', colors.dim);
  log('Tip: You can paste your Shopify admin URL directly:', colors.dim);
  log('     https://admin.shopify.com/store/your-store/themes\n', colors.dim);

  const _storeInput = await prompt('Store URL or admin URL:');
  const _normalizedStoreUrl = parseStoreUrl(_storeInput);

  if (_normalizedStoreUrl) {
    log(`Store: ${_normalizedStoreUrl}`, colors.green);
  }

  log('\nTheme Access Token is required to fetch your themes.', colors.dim);
  log('Get it from: Shopify Admin → Settings → Apps and sales channels → Develop apps\n', colors.dim);
  const _storePassword = await prompt('Theme Access Token:');

  const _environmentName = (await prompt('Environment name (default: development):')) || 'development';

  let _themeId: string | null = null;

  if (_normalizedStoreUrl && _storePassword) {
    log('\nFetching themes from store...', colors.cyan);
    const _themes = await getShopifyThemes(_normalizedStoreUrl, _storePassword);

    if (_themes.length > 0) {
      log('', colors.reset);
      const _themeOptions = _themes.map(
        (_t) => `${_t.name} (${_t.role}) - ID: ${_t.id}`
      );
      _themeOptions.push('Skip - configure later');

      const _themeChoice = await select('Select theme for development:', _themeOptions);

      if (_themeChoice < _themes.length) {
        _themeId = _themes[_themeChoice].id;
        log(`\nSelected: ${_themes[_themeChoice].name}`, colors.green);
      }
    } else {
      log('Could not fetch themes. Check your store URL and access password.', colors.yellow);
      log('You can configure the theme ID manually in shopify.theme.toml\n', colors.dim);
    }
  } else {
    log('Skipping theme fetch — store URL or password not provided.', colors.yellow);
  }

  return {
    projectName: _projectName,
    projectNameSafe: _projectNameSafe,
    stylingApproach: _stylingApproach,
    jsApproach: _jsApproach,
    packageManager: _packageManager,
    storeUrl: _normalizedStoreUrl,
    storePassword: _storePassword,
    environmentName: _environmentName,
    themeId: _themeId,
  };
}

// =============================================================================
// FILE GENERATORS
// =============================================================================

async function createDirectoryStructure(config: SetupConfig): Promise<void> {
  header('Creating Directory Structure');

  const _ext = config.jsApproach === 'typescript' ? 'ts' : 'js';

  const _dirs = [
    '.claude/agents',
    'frontend/entrypoints',
    `frontend/scripts/components/sections`,
    `frontend/scripts/components/shared`,
    'frontend/scripts/hooks/core',
    'frontend/scripts/types',
    'frontend/scripts/constants',
    'frontend/scripts/utils',
    'frontend/styles/sections',
    'frontend/styles/components',
    '.github/workflows',
  ];

  for (const _dir of _dirs) {
    await mkdir(_dir, { recursive: true });
    log(`Created: ${_dir}`, colors.green);
  }
}

async function createPackageJson(config: SetupConfig): Promise<void> {
  header('Creating package.json');

  const _runCmd = config.packageManager === 'yarn' ? 'yarn' : 'bun run';

  const _packageJson = {
    name: `${config.projectName}-theme`,
    version: '1.0.0',
    type: 'module',
    packageManager: config.packageManager === 'yarn' ? 'yarn@1.22.22' : 'bun@1.2.0',
    scripts: {
      dev: 'run-p -sr "shopify:dev" "vite:dev"',
      build: `${_runCmd} vite:build`,
      deploy: 'run-s "vite:build" "shopify:push"',
      'deploy:staging': 'run-s "vite:build" "shopify:push:staging"',
      'deploy:production': 'run-s "vite:build" "shopify:push:production"',
      'shopify:dev': `shopify theme dev --environment ${config.environmentName}`,
      'shopify:dev:staging': 'shopify theme dev --environment staging',
      'shopify:dev:production': 'shopify theme dev --environment production',
      'shopify:push': `shopify theme push --environment ${config.environmentName}`,
      'shopify:push:staging': 'shopify theme push --environment staging',
      'shopify:push:production': 'shopify theme push --environment production',
      'vite:dev': 'vite',
      'vite:build': 'vite build',
      'type-check': config.jsApproach === 'typescript' ? 'tsc --noEmit' : undefined,
      clean: 'rm -rf dist assets/storefront.js assets/custom_styling.css',
    },
  };

  // Remove undefined scripts
  Object.keys(_packageJson.scripts).forEach((_key) => {
    if (_packageJson.scripts[_key as keyof typeof _packageJson.scripts] === undefined) {
      delete _packageJson.scripts[_key as keyof typeof _packageJson.scripts];
    }
  });

  await writeFile('package.json', JSON.stringify(_packageJson, null, 2));
  log('Created: package.json', colors.green);
}

async function installDependencies(config: SetupConfig): Promise<void> {
  header('Installing Dependencies');

  const _deps = [
    'vite',
    'vite-plugin-shopify',
    'postcss',
    'autoprefixer',
    'npm-run-all',
  ];

  if (config.stylingApproach === 'scss') {
    _deps.push('sass');
  } else if (config.stylingApproach === 'tailwind') {
    _deps.push('tailwindcss');
  }

  if (config.jsApproach === 'typescript') {
    _deps.push('typescript', '@types/node');
  }

  log(`Installing with ${config.packageManager}...`, colors.cyan);

  try {
    if (config.packageManager === 'bun') {
      await $`bun add -d ${_deps}`;
    } else {
      await $`yarn add -D ${_deps}`;
    }
    log('Dependencies installed successfully', colors.green);
  } catch (_error) {
    log('Error installing dependencies', colors.red);
    console.error(_error);
  }
}

async function createViteConfig(config: SetupConfig): Promise<void> {
  header('Creating Vite Configuration');

  const _scssPreprocessor =
    config.stylingApproach === 'scss'
      ? `
    preprocessorOptions: {
      scss: {
        additionalData: '@use "sass:math"; @use "sass:map";',
        api: 'modern-compiler',
        quietDeps: true,
        logger: {
          warn: () => { }
        }
      }
    }`
      : '';

  const _viteConfig = `import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import shopify from 'vite-plugin-shopify';
import { readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const ASSETS_DIR = path.resolve('./assets');
const MANIFEST_PATH = path.join(ASSETS_DIR, '.vite', 'manifest.json');

/**
 * Deletes all files previously emitted by Vite (tracked in manifest.json).
 * Non-Vite theme assets (theme.js, vendor.js, etc.) are untouched.
 */
function cleanViteAssets() {
  return {
    name: 'clean-vite-assets',
    buildStart() {
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
      } catch {
        return; // No previous manifest — first build
      }

      const filesToDelete = new Set(
        Object.values(manifest).flatMap((entry) => {
          const files = [entry.file];
          if (entry.css) files.push(...entry.css);
          return files;
        })
      );

      filesToDelete.forEach((file) => {
        try {
          unlinkSync(path.join(ASSETS_DIR, file));
        } catch { /* ignore if already gone */ }
      });
    },
  };
}

export default defineConfig(() => ({
  plugins: [
    cleanViteAssets(),
    shopify({
      themeRoot: './',
      sourceCodeDir: 'frontend',
      entrypointsDir: 'frontend/entrypoints',
      snippetFile: 'vite-tag.liquid',
      themeHotReload: true,
      versionNumbers: true,
    }),
  ],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./frontend', import.meta.url)),
      '@': fileURLToPath(new URL('./frontend/scripts', import.meta.url)),
    },
  },
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
        chunkFileNames: '[name]-[hash].js',
        preserveModules: false,
        manualChunks: undefined,
      }
    }
  },
  server: {
    host: '127.0.0.1',
    cors: {
      origin: [/\\.myshopify\\.com$/, /^https?:\\/\\/127\\.0\\.0\\.1(:\\d+)?$/, /^https?:\\/\\/localhost(:\\d+)?$/],
    },
  },
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase'
    },${_scssPreprocessor}
  }
}));
`;

  await writeFile('vite.config.js', _viteConfig);
  log('Created: vite.config.js', colors.green);
}

async function createPostCSSConfig(config: SetupConfig): Promise<void> {
  const _plugins =
    config.stylingApproach === 'tailwind'
      ? `{
    tailwindcss: {},
    autoprefixer: {},
  }`
      : `{
    autoprefixer: {},
  }`;

  const _postcssConfig = `export default {
  plugins: ${_plugins},
}
`;

  await writeFile('postcss.config.js', _postcssConfig);
  log('Created: postcss.config.js', colors.green);
}

async function createTailwindConfig(config: SetupConfig): Promise<void> {
  if (config.stylingApproach !== 'tailwind') return;

  header('Creating Tailwind Configuration');

  const _tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './layout/**/*.liquid',
    './sections/**/*.liquid',
    './snippets/**/*.liquid',
    './templates/**/*.liquid',
    './frontend/**/*.{js,ts,css,scss}',
  ],
  theme: {
    extend: {
      // Add your custom theme extensions here
      colors: {
        // Use CSS variables from Shopify theme settings
        primary: 'rgb(var(--color-button) / <alpha-value>)',
        secondary: 'rgb(var(--color-accent) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
`;

  await writeFile('tailwind.config.js', _tailwindConfig);
  log('Created: tailwind.config.js', colors.green);

  log('\nTailwind is configured to use @apply in CSS files.', colors.yellow);
  log('DO NOT use inline utility classes in Liquid templates.\n', colors.yellow);
}

async function createTypeScriptConfig(config: SetupConfig): Promise<void> {
  if (config.jsApproach !== 'typescript') return;

  header('Creating TypeScript Configuration');

  const _tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
      isolatedModules: true,
      verbatimModuleSyntax: true,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      baseUrl: '.',
      paths: {
        '~/*': ['./frontend/*'],
        '@/*': ['./frontend/scripts/*'],
      },
    },
    include: ['frontend/**/*'],
    exclude: ['node_modules', 'assets'],
  };

  await writeFile('tsconfig.json', JSON.stringify(_tsConfig, null, 2));
  log('Created: tsconfig.json', colors.green);
}

async function createShopifyThemeToml(config: SetupConfig): Promise<void> {
  header('Creating shopify.theme.toml');

  const _toml = `# Shopify Theme Configuration
# This file is gitignored to protect credentials

[environments.${config.environmentName}]
store = "${config.storeUrl || 'your-store.myshopify.com'}"
theme = "${config.themeId || 'YOUR_THEME_ID'}"
password = "${config.storePassword || 'YOUR_THEME_ACCESS_TOKEN'}"
ignore = [".shopifyignore"]

# [environments.staging]
# store = "${config.storeUrl || 'your-store.myshopify.com'}"
# theme = "STAGING_THEME_ID"
# password = "YOUR_THEME_ACCESS_TOKEN"
# ignore = [".shopifyignore"]

# [environments.production]
# store = "${config.storeUrl || 'your-store.myshopify.com'}"
# theme = "PRODUCTION_THEME_ID"
# password = "YOUR_THEME_ACCESS_TOKEN"
# ignore = [".shopifyignore"]
`;

  await writeFile('shopify.theme.toml', _toml);
  log('Created: shopify.theme.toml', colors.green);
}

async function createGitIgnore(): Promise<void> {
  const _gitignore = `# Dependencies
node_modules/

# Environment
.env
.env.*
.env.local

# Vite
dist/
.vite/

# Shopify
config/settings_data.json
shopify.theme.toml

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
.idea/

# Logs
*.log
`;

  await writeFile('.gitignore', _gitignore);
  log('Created: .gitignore', colors.green);
}

async function createShopifyIgnore(): Promise<void> {
  const _shopifyignore = `# Source files (Vite compiles these)
frontend/

# Config files
vite.config.js
postcss.config.js
tailwind.config.js
tsconfig.json
package.json
bun.lockb
yarn.lock

# Git
.git/
.gitignore

# CI/CD
.github/

# Documentation
*.md

# Setup
setup.ts

# Claude
.claude/

# Environment
.env*

# Editor
.vscode/
.idea/

# OS
.DS_Store
`;

  await writeFile('.shopifyignore', _shopifyignore);
  log('Created: .shopifyignore', colors.green);
}

async function createGitHubWorkflow(config: SetupConfig): Promise<void> {
  const _pm = config.packageManager;
  const _setupAction = _pm === 'bun' ? 'oven-sh/setup-bun@v1' : 'actions/setup-node@v4';
  const _setupWith = _pm === 'bun' ? 'bun-version: latest' : 'node-version: 20';

  const _workflow = `name: Build Assets

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup ${_pm === 'bun' ? 'Bun' : 'Node.js'}
        uses: ${_setupAction}
        with:
          ${_setupWith}

      - name: Install dependencies
        run: ${_pm} install

      - name: Build assets
        run: ${_pm} run build

      - name: Check assets are in sync
        run: |
          git diff --exit-code assets/ || \\
          (echo "Assets out of sync. Run '${_pm} run build' and commit." && exit 1)
`;

  await writeFile('.github/workflows/build.yml', _workflow);
  log('Created: .github/workflows/build.yml', colors.green);
}

// =============================================================================
// FRONTEND FILES
// =============================================================================

async function createEntrypoints(config: SetupConfig): Promise<void> {
  header('Creating Entry Points');

  const _ext = config.jsApproach === 'typescript' ? 'ts' : 'js';
  const _styleExt = config.stylingApproach === 'scss' ? 'scss' : 'css';

  // storefront.ts/js
  const _storefront = `/**
 * Storefront Entry Point
 * Initializes Custom Elements and Section Registry
 */

import 'vite/modulepreload-polyfill';
import { registerAllSections } from '@/hooks/core/sectionRegistry';
import { consoleMessage } from '@/utils';

// =============================================================================
// GLOBAL STORE OBJECT
// =============================================================================

${config.jsApproach === 'typescript' ? `declare global {
  interface Window {
    ${config.projectNameSafe}: StorefrontGlobal;
    Shopify?: {
      shop?: string;
      currency?: { active: string };
      designMode?: boolean;
    };
    theme?: {
      moneyFormat?: string;
    };
  }
}

interface StorefrontGlobal {
  settings: {
    devMode: boolean;
    debugEvents: boolean;
  };
  theme: {
    shopName: string;
    currency: string;
    moneyFormat: string;
  };
  cart: {
    count: number;
    total: number;
  };
  events: EventTarget;
  version: string;
}
` : ''}
window.${config.projectNameSafe} = {
  settings: {
    devMode: import.meta.env.DEV,
    debugEvents: false,
  },
  theme: {
    shopName: window.Shopify?.shop || '${config.projectName}',
    currency: window.Shopify?.currency?.active || 'USD',
    moneyFormat: window.theme?.moneyFormat || '\${{amount}}',
  },
  cart: {
    count: 0,
    total: 0,
  },
  events: new EventTarget(),
  version: '1.0.0',
};

// =============================================================================
// INITIALIZATION
// =============================================================================

function initializeApp()${config.jsApproach === 'typescript' ? ': void' : ''} {
  consoleMessage('[Init] Starting application', 'info');

  // Register all section Custom Elements
  registerAllSections();

  consoleMessage('[Init] Application ready', 'info', {
    version: window.${config.projectNameSafe}.version,
    devMode: window.${config.projectNameSafe}.settings.devMode,
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

export default window.${config.projectNameSafe};
`;

  await writeFile(`frontend/entrypoints/storefront.${_ext}`, _storefront);
  log(`Created: frontend/entrypoints/storefront.${_ext}`, colors.green);

  // custom_styling.scss/css
  let _styles = '';

  if (config.stylingApproach === 'scss') {
    _styles = `/**
 * Custom Styling Entry Point (SCSS)
 */

// =============================================================================
// DESIGN TOKENS
// =============================================================================

$colors: (
  'primary': rgb(var(--color-button)),
  'secondary': rgb(var(--color-accent)),
  'text': #1a1a1a,
  'text-muted': #666,
  'surface': #ffffff,
  'border': #e5e5e5,
);

$spacing: (
  'xs': 0.25rem,
  'sm': 0.5rem,
  'md': 1rem,
  'lg': 2rem,
  'xl': 4rem,
);

$breakpoints: (
  'sm': 640px,
  'md': 768px,
  'lg': 1024px,
  'xl': 1280px,
);

$transitions: (
  'fast': 150ms ease,
  'base': 250ms ease,
  'slow': 400ms ease,
);

// =============================================================================
// MIXINS
// =============================================================================

@mixin min($breakpoint) {
  @if map-has-key($breakpoints, $breakpoint) {
    @media (min-width: map-get($breakpoints, $breakpoint)) {
      @content;
    }
  }
}

@function color($key) {
  @return map-get($colors, $key);
}

@function spacing($key) {
  @return map-get($spacing, $key);
}

@function transition($key) {
  @return map-get($transitions, $key);
}

// =============================================================================
// CSS CUSTOM PROPERTIES
// =============================================================================

:root {
  --spacing-xs: #{spacing('xs')};
  --spacing-sm: #{spacing('sm')};
  --spacing-md: #{spacing('md')};
  --spacing-lg: #{spacing('lg')};
  --spacing-xl: #{spacing('xl')};
  --transition-fast: #{transition('fast')};
  --transition-base: #{transition('base')};
  --border-radius: 4px;
}

// =============================================================================
// UTILITIES
// =============================================================================

.visually-hidden {
  position: absolute !important;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// =============================================================================
// COMPONENT IMPORTS
// =============================================================================

// @use '../styles/sections/featured-collection';
// @use '../styles/components/product-card';
`;
  } else if (config.stylingApproach === 'tailwind') {
    _styles = `/**
 * Custom Styling Entry Point (Tailwind)
 *
 * IMPORTANT: Use @apply in this file, NOT inline utilities in Liquid.
 */

@tailwind base;
@tailwind components;
@tailwind utilities;

// =============================================================================
// CSS CUSTOM PROPERTIES (for Shopify theme settings)
// =============================================================================

:root {
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 2rem;
  --spacing-xl: 4rem;
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --border-radius: 4px;
}

// =============================================================================
// COMPONENT STYLES (using @apply)
// =============================================================================

.visually-hidden {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
  clip: rect(0, 0, 0, 0);
}

// Example component using @apply:
// .product-card {
//   @apply flex flex-col gap-4;
//   @apply bg-white rounded-lg shadow-sm;
//   @apply transition-shadow duration-200;
//
//   &:hover {
//     @apply shadow-md;
//   }
//
//   &__title {
//     @apply text-lg font-semibold text-gray-900;
//   }
//
//   &__price {
//     @apply text-base text-gray-600;
//   }
// }

// =============================================================================
// COMPONENT IMPORTS
// =============================================================================

// @import '../styles/sections/featured-collection';
// @import '../styles/components/product-card';
`;
  } else {
    _styles = `/**
 * Custom Styling Entry Point (CSS)
 */

/* =============================================================================
   DESIGN TOKENS
   ============================================================================= */

:root {
  /* Colors */
  --color-primary: rgb(var(--color-button));
  --color-secondary: rgb(var(--color-accent));
  --color-text: #1a1a1a;
  --color-text-muted: #666;
  --color-surface: #ffffff;
  --color-border: #e5e5e5;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 2rem;
  --spacing-xl: 4rem;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;

  /* Borders */
  --border-radius: 4px;
}

/* =============================================================================
   UTILITIES
   ============================================================================= */

.visually-hidden {
  position: absolute !important;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* =============================================================================
   COMPONENT IMPORTS
   ============================================================================= */

/* @import '../styles/sections/featured-collection.css'; */
/* @import '../styles/components/product-card.css'; */
`;
  }

  await writeFile(`frontend/entrypoints/custom_styling.${_styleExt}`, _styles);
  log(`Created: frontend/entrypoints/custom_styling.${_styleExt}`, colors.green);
}

async function createUtilities(config: SetupConfig): Promise<void> {
  header('Creating Utilities');

  const _ext = config.jsApproach === 'typescript' ? 'ts' : 'js';
  const _typeAnnotations = config.jsApproach === 'typescript';

  // utils/index.ts
  const _utils = `/**
 * Utility Functions
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error';

/**
 * Console message that respects devMode setting
 */
export function consoleMessage(
  message${_typeAnnotations ? ': string' : ''},
  level${_typeAnnotations ? ': LogLevel' : ''} = 'log',
  data${_typeAnnotations ? ': unknown' : ''} = null
)${_typeAnnotations ? ': void' : ''} {
  if (!window.${config.projectNameSafe}?.settings?.devMode) return;

  const _prefix = '[${config.projectName}]';
  const _styles${_typeAnnotations ? ': Record<LogLevel, string>' : ''} = {
    log: 'color: #6b7280',
    info: 'color: #3b82f6',
    warn: 'color: #f59e0b',
    error: 'color: #ef4444',
  };

  if (data) {
    console[level](\`%c\${_prefix} \${message}\`, _styles[level], data);
  } else {
    console[level](\`%c\${_prefix} \${message}\`, _styles[level]);
  }
}

/**
 * Debounce function for rate-limiting
 */
export function debounce${_typeAnnotations ? '<T extends (...args: unknown[]) => void>' : ''}(
  fn${_typeAnnotations ? ': T' : ''},
  wait${_typeAnnotations ? ': number' : ''}
)${_typeAnnotations ? ': (...args: Parameters<T>) => void' : ''} {
  let _timeout${_typeAnnotations ? ': ReturnType<typeof setTimeout> | null' : ''} = null;

  return function executedFunction(...args${_typeAnnotations ? ': Parameters<T>' : ''}) {
    if (_timeout) clearTimeout(_timeout);
    _timeout = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Throttle function for rate-limiting
 */
export function throttle${_typeAnnotations ? '<T extends (...args: unknown[]) => void>' : ''}(
  fn${_typeAnnotations ? ': T' : ''},
  wait${_typeAnnotations ? ': number' : ''}
)${_typeAnnotations ? ': (...args: Parameters<T>) => void' : ''} {
  let _lastTime = 0;

  return function executedFunction(...args${_typeAnnotations ? ': Parameters<T>' : ''}) {
    const _now = Date.now();
    if (_now - _lastTime >= wait) {
      _lastTime = _now;
      fn(...args);
    }
  };
}

/**
 * Dispatch custom event on window.${config.projectNameSafe}.events
 */
export function dispatchStoreEvent(
  name${_typeAnnotations ? ': string' : ''},
  detail${_typeAnnotations ? ': unknown' : ''} = {}
)${_typeAnnotations ? ': void' : ''} {
  const _event = new CustomEvent(name, { detail });
  window.${config.projectNameSafe}.events.dispatchEvent(_event);

  if (window.${config.projectNameSafe}.settings.debugEvents) {
    consoleMessage(\`Event: \${name}\`, 'info', detail);
  }
}

/**
 * Subscribe to custom event on window.${config.projectNameSafe}.events
 */
export function subscribeToStoreEvent(
  name${_typeAnnotations ? ': string' : ''},
  callback${_typeAnnotations ? ': (event: CustomEvent) => void' : ''}
)${_typeAnnotations ? ': () => void' : ''} {
  const _handler = (event${_typeAnnotations ? ': Event' : ''}) => callback(event${_typeAnnotations ? ' as CustomEvent' : ''});
  window.${config.projectNameSafe}.events.addEventListener(name, _handler);

  // Return unsubscribe function
  return () => window.${config.projectNameSafe}.events.removeEventListener(name, _handler);
}
`;

  await writeFile(`frontend/scripts/utils/index.${_ext}`, _utils);
  log(`Created: frontend/scripts/utils/index.${_ext}`, colors.green);
}

async function createConstants(config: SetupConfig): Promise<void> {
  const _ext = config.jsApproach === 'typescript' ? 'ts' : 'js';
  const _typeAnnotations = config.jsApproach === 'typescript';

  const _constants = `/**
 * Global Constants
 */

export const BREAKPOINTS${_typeAnnotations ? ': Readonly<Record<string, number>>' : ''} = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
}${_typeAnnotations ? ' as const' : ''};

export const ANIMATION${_typeAnnotations ? ': Readonly<{ DURATION: Record<string, number>; EASING: Record<string, string> }>' : ''} = {
  DURATION: {
    FAST: 150,
    BASE: 250,
    SLOW: 400,
  },
  EASING: {
    DEFAULT: 'ease',
    SPRING: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    SMOOTH: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
}${_typeAnnotations ? ' as const' : ''};

export const SELECTORS${_typeAnnotations ? ': Readonly<Record<string, string>>' : ''} = {
  SECTION: '[data-section-id]',
  SECTION_TYPE: '[data-section-type]',
}${_typeAnnotations ? ' as const' : ''};

export const EVENTS${_typeAnnotations ? ': Readonly<Record<string, string>>' : ''} = {
  CART_UPDATED: 'cart:updated',
  CART_ADD: 'cart:add',
  VARIANT_CHANGE: 'variant:change',
  MODAL_OPEN: 'modal:open',
  MODAL_CLOSE: 'modal:close',
  DRAWER_OPEN: 'drawer:open',
  DRAWER_CLOSE: 'drawer:close',
}${_typeAnnotations ? ' as const' : ''};
`;

  await writeFile(`frontend/scripts/constants/index.${_ext}`, _constants);
  log(`Created: frontend/scripts/constants/index.${_ext}`, colors.green);
}

async function createSectionRegistry(config: SetupConfig): Promise<void> {
  header('Creating Section Registry');

  const _ext = config.jsApproach === 'typescript' ? 'ts' : 'js';
  const _typeAnnotations = config.jsApproach === 'typescript';

  const _sectionRegistry = `/**
 * Section Registry
 *
 * Manages Custom Element registration and Shopify Theme Editor lifecycle.
 * Each section component is a Custom Element that extends HTMLElement.
 */

import { consoleMessage } from '@/utils';

${_typeAnnotations ? `
// =============================================================================
// TYPES
// =============================================================================

export interface SectionCallbacks {
  /** Called when section loads (page load or Theme Editor) */
  onLoad?: (container: HTMLElement) => void;
  /** Called when section unloads (Theme Editor only) */
  onUnload?: (container: HTMLElement) => void;
  /** Called when a block is selected in Theme Editor */
  onBlockSelect?: (event: CustomEvent) => void;
  /** Called when a block is deselected in Theme Editor */
  onBlockDeselect?: (event: CustomEvent) => void;
  /** Called when section is selected in Theme Editor */
  onSelect?: (event: CustomEvent) => void;
  /** Called when section is deselected in Theme Editor */
  onDeselect?: (event: CustomEvent) => void;
}

interface RegisteredSection {
  elementName: string;
  callbacks: SectionCallbacks;
}
` : ''}
// =============================================================================
// REGISTRY
// =============================================================================

const _registeredSections${_typeAnnotations ? ': Map<string, RegisteredSection>' : ''} = new Map();

/**
 * Register a Custom Element as a section component
 *
 * @param sectionType - The section type (matches data-section-type in Liquid)
 * @param elementName - The custom element tag name (e.g., 'featured-collection')
 * @param elementClass - The Custom Element class
 * @param callbacks - Optional Theme Editor lifecycle callbacks
 */
export function registerSection${_typeAnnotations ? '<T extends typeof HTMLElement>' : ''}(
  sectionType${_typeAnnotations ? ': string' : ''},
  elementName${_typeAnnotations ? ': string' : ''},
  elementClass${_typeAnnotations ? ': T' : ''},
  callbacks${_typeAnnotations ? ': SectionCallbacks' : ''} = {}
)${_typeAnnotations ? ': void' : ''} {
  // Register Custom Element (check first to avoid errors)
  if (!customElements.get(elementName)) {
    customElements.define(elementName, elementClass);
    consoleMessage(\`Registered: <\${elementName}>\`, 'info');
  }

  // Store for Theme Editor lifecycle
  _registeredSections.set(sectionType, { elementName, callbacks });
}

/**
 * Register all section components
 * Import and register your sections here
 */
export function registerAllSections()${_typeAnnotations ? ': void' : ''} {
  // Example:
  // import { FeaturedCollection } from '@/components/sections/featured-collection';
  // registerSection('featured-collection', 'featured-collection', FeaturedCollection, {
  //   onBlockSelect: (event) => { /* handle block select */ },
  // });

  consoleMessage('Section registration complete', 'info');
}

// =============================================================================
// THEME EDITOR LIFECYCLE
// =============================================================================

/**
 * Initialize Theme Editor event listeners
 * Only active when Shopify.designMode is true
 */
export function initThemeEditorListeners()${_typeAnnotations ? ': void' : ''} {
  if (!window.Shopify?.designMode) return;

  document.addEventListener('shopify:section:load', _handleSectionLoad);
  document.addEventListener('shopify:section:unload', _handleSectionUnload);
  document.addEventListener('shopify:section:select', _handleSectionSelect);
  document.addEventListener('shopify:section:deselect', _handleSectionDeselect);
  document.addEventListener('shopify:block:select', _handleBlockSelect);
  document.addEventListener('shopify:block:deselect', _handleBlockDeselect);

  consoleMessage('Theme Editor listeners initialized', 'info');
}

function _handleSectionLoad(event${_typeAnnotations ? ': Event' : ''})${_typeAnnotations ? ': void' : ''} {
  const _container = (event${_typeAnnotations ? ' as CustomEvent' : ''}).target${_typeAnnotations ? ' as HTMLElement' : ''};
  const _sectionType = _container?.dataset?.sectionType;

  if (!_sectionType) return;

  const _section = _registeredSections.get(_sectionType);
  _section?.callbacks.onLoad?.(_container);
}

function _handleSectionUnload(event${_typeAnnotations ? ': Event' : ''})${_typeAnnotations ? ': void' : ''} {
  const _container = (event${_typeAnnotations ? ' as CustomEvent' : ''}).target${_typeAnnotations ? ' as HTMLElement' : ''};
  const _sectionType = _container?.dataset?.sectionType;

  if (!_sectionType) return;

  const _section = _registeredSections.get(_sectionType);
  _section?.callbacks.onUnload?.(_container);
}

function _handleSectionSelect(event${_typeAnnotations ? ': Event' : ''})${_typeAnnotations ? ': void' : ''} {
  const _customEvent = event${_typeAnnotations ? ' as CustomEvent' : ''};
  const _container = _customEvent.target${_typeAnnotations ? ' as HTMLElement' : ''};
  const _sectionType = _container?.dataset?.sectionType;

  if (!_sectionType) return;

  const _section = _registeredSections.get(_sectionType);
  _section?.callbacks.onSelect?.(_customEvent);
}

function _handleSectionDeselect(event${_typeAnnotations ? ': Event' : ''})${_typeAnnotations ? ': void' : ''} {
  const _customEvent = event${_typeAnnotations ? ' as CustomEvent' : ''};
  const _container = _customEvent.target${_typeAnnotations ? ' as HTMLElement' : ''};
  const _sectionType = _container?.dataset?.sectionType;

  if (!_sectionType) return;

  const _section = _registeredSections.get(_sectionType);
  _section?.callbacks.onDeselect?.(_customEvent);
}

function _handleBlockSelect(event${_typeAnnotations ? ': Event' : ''})${_typeAnnotations ? ': void' : ''} {
  const _customEvent = event${_typeAnnotations ? ' as CustomEvent' : ''};
  const _container = (_customEvent.target${_typeAnnotations ? ' as HTMLElement' : ''})?.closest('[data-section-type]')${_typeAnnotations ? ' as HTMLElement | null' : ''};
  const _sectionType = _container?.dataset?.sectionType;

  if (!_sectionType) return;

  const _section = _registeredSections.get(_sectionType);
  _section?.callbacks.onBlockSelect?.(_customEvent);
}

function _handleBlockDeselect(event${_typeAnnotations ? ': Event' : ''})${_typeAnnotations ? ': void' : ''} {
  const _customEvent = event${_typeAnnotations ? ' as CustomEvent' : ''};
  const _container = (_customEvent.target${_typeAnnotations ? ' as HTMLElement' : ''})?.closest('[data-section-type]')${_typeAnnotations ? ' as HTMLElement | null' : ''};
  const _sectionType = _container?.dataset?.sectionType;

  if (!_sectionType) return;

  const _section = _registeredSections.get(_sectionType);
  _section?.callbacks.onBlockDeselect?.(_customEvent);
}

// Initialize Theme Editor listeners
initThemeEditorListeners();
`;

  await writeFile(`frontend/scripts/hooks/core/sectionRegistry.${_ext}`, _sectionRegistry);
  log(`Created: frontend/scripts/hooks/core/sectionRegistry.${_ext}`, colors.green);
}

async function createExampleSection(config: SetupConfig): Promise<void> {
  header('Creating Example Section Component');

  const _ext = config.jsApproach === 'typescript' ? 'ts' : 'js';
  const _typeAnnotations = config.jsApproach === 'typescript';

  const _exampleSection = `/**
 * Example Section Component (Custom Element)
 *
 * Usage in Liquid:
 * <featured-collection
 *   data-section-id="{{ section.id }}"
 *   data-section-type="featured-collection"
 * >
 *   ...
 * </featured-collection>
 */

import { consoleMessage } from '@/utils';

${_typeAnnotations ? `
interface FeaturedCollectionConfig {
  autoplay: boolean;
  speed: number;
}
` : ''}
export class FeaturedCollection extends HTMLElement {
  // Cache DOM references
  _container${_typeAnnotations ? ': HTMLElement | null' : ''} = null;
  _slides${_typeAnnotations ? ': NodeListOf<HTMLElement> | null' : ''} = null;

  // State
  _isInitialized = false;
  _config${_typeAnnotations ? ': FeaturedCollectionConfig' : ''} = {
    autoplay: false,
    speed: 300,
  };

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Called when element is added to DOM
   */
  connectedCallback()${_typeAnnotations ? ': void' : ''} {
    // Guard: prevent double initialization
    if (this._isInitialized) return;

    this._init();
  }

  /**
   * Called when element is removed from DOM
   */
  disconnectedCallback()${_typeAnnotations ? ': void' : ''} {
    this._destroy();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  _init()${_typeAnnotations ? ': void' : ''} {
    // Parse config from data attributes
    this._parseConfig();

    // Cache DOM elements
    this._cacheElements();

    // Guard: required elements
    if (!this._container) {
      consoleMessage('FeaturedCollection: Missing container', 'warn');
      return;
    }

    // Bind events
    this._bindEvents();

    this._isInitialized = true;
    consoleMessage('FeaturedCollection initialized', 'info');
  }

  _parseConfig()${_typeAnnotations ? ': void' : ''} {
    const _configAttr = this.dataset.config;
    if (!_configAttr) return;

    try {
      const _parsed = JSON.parse(_configAttr);
      this._config = { ...this._config, ..._parsed };
    } catch {
      consoleMessage('FeaturedCollection: Invalid config JSON', 'warn');
    }
  }

  _cacheElements()${_typeAnnotations ? ': void' : ''} {
    this._container = this.querySelector('.featured-collection__container');
    this._slides = this.querySelectorAll('.featured-collection__slide');
  }

  _bindEvents()${_typeAnnotations ? ': void' : ''} {
    // Example: bind click handler
    // this._container?.addEventListener('click', this._handleClick);
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  _destroy()${_typeAnnotations ? ': void' : ''} {
    // Remove event listeners
    // this._container?.removeEventListener('click', this._handleClick);

    // Clear references
    this._container = null;
    this._slides = null;
    this._isInitialized = false;

    consoleMessage('FeaturedCollection destroyed', 'info');
  }

  // ==========================================================================
  // EVENT HANDLERS (use arrow functions to preserve 'this')
  // ==========================================================================

  _handleClick = (event${_typeAnnotations ? ': Event' : ''})${_typeAnnotations ? ': void' : ''} => {
    const _target = event.target${_typeAnnotations ? ' as HTMLElement' : ''};

    // Early return pattern
    if (!_target) return;
    if (!_target.closest('.featured-collection__item')) return;

    // Main logic
    consoleMessage('Item clicked', 'info', { target: _target });
  };
}

// Note: Registration happens in sectionRegistry.ts
// registerSection('featured-collection', 'featured-collection', FeaturedCollection);
`;

  await writeFile(
    `frontend/scripts/components/sections/featured-collection.${_ext}`,
    _exampleSection
  );
  log(`Created: frontend/scripts/components/sections/featured-collection.${_ext}`, colors.green);
}

// =============================================================================
// CLAUDE FILES
// =============================================================================

async function createClaudeMd(config: SetupConfig): Promise<void> {
  header('Creating CLAUDE.md Files');

  // .claude/CLAUDE.md - Project rules
  const _projectClaudeMd = `# ${config.projectName} - Project Rules

## Project Overview

Shopify theme development project using Custom Elements + Section Registry pattern.

- **Styling**: ${config.stylingApproach.toUpperCase()}${config.stylingApproach === 'tailwind' ? ' (using @apply, NOT inline utilities)' : ''}
- **JavaScript**: ${config.jsApproach === 'typescript' ? 'TypeScript' : 'Vanilla JavaScript'}
- **Package Manager**: ${config.packageManager}
- **Build**: Vite + vite-plugin-shopify

---

## Critical Rules

### Build Commands
- **MUST NOT** run \`${config.packageManager} run build\` unless explicitly requested
- **MUST NOT** run \`shopify theme push\` unless explicitly requested

### Code Style

#### Naming Conventions
- **MUST** prefix function-scoped variables with underscore: \`_element\`, \`_data\`
- **MUST** use PascalCase for classes: \`FeaturedCollection\`, \`ProductCard\`
- **MUST** use camelCase for functions: \`handleClick\`, \`initializeApp\`
- **MUST** use UPPER_SNAKE_CASE for constants: \`BREAKPOINTS\`, \`ANIMATION\`

#### Early Returns
- **MUST** use guard clauses at the start of functions
- **MUST NOT** nest conditions more than 2 levels deep

\`\`\`${config.jsApproach === 'typescript' ? 'typescript' : 'javascript'}
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
\`\`\`

### Logging
- **MUST** use \`consoleMessage()\` utility, never \`console.log\` directly
- Logging respects \`window.${config.projectNameSafe}.settings.devMode\`

### Custom Elements
- **MUST** check \`customElements.get()\` before registering
- **MUST** implement \`connectedCallback()\` and \`disconnectedCallback()\`
- **MUST** clean up event listeners in \`disconnectedCallback()\`

### State Classes
- Use \`.is-active\`, \`.is-loading\`, \`.is-hidden\`, \`.is-open\`
- Never use \`.active\`, \`.loading\`, \`.hidden\` (too generic)

---

## File Locations

| Type | Location |
|------|----------|
| Section components | \`frontend/scripts/components/sections/\` |
| Shared components | \`frontend/scripts/components/shared/\` |
| Utilities | \`frontend/scripts/utils/\` |
| Constants | \`frontend/scripts/constants/\` |
| Types | \`frontend/scripts/types/\` |
| Section styles | \`frontend/styles/sections/\` |
| Component styles | \`frontend/styles/components/\` |

---

## Global Object

Access via \`window.${config.projectNameSafe}\`:

\`\`\`${config.jsApproach === 'typescript' ? 'typescript' : 'javascript'}
window.${config.projectNameSafe}.settings.devMode  // boolean
window.${config.projectNameSafe}.theme.currency    // string
window.${config.projectNameSafe}.cart.count        // number
window.${config.projectNameSafe}.events            // EventTarget
\`\`\`

---

## Events

Dispatch events via:
\`\`\`${config.jsApproach === 'typescript' ? 'typescript' : 'javascript'}
import { dispatchStoreEvent } from '@/utils';

dispatchStoreEvent('cart:updated', { count: 5 });
\`\`\`

Subscribe to events:
\`\`\`${config.jsApproach === 'typescript' ? 'typescript' : 'javascript'}
import { subscribeToStoreEvent } from '@/utils';

const unsubscribe = subscribeToStoreEvent('cart:updated', (event) => {
  console.log(event.detail.count);
});

// Later: unsubscribe();
\`\`\`

---

## Quick Commands

\`\`\`bash
${config.packageManager} run dev       # Start development
${config.packageManager} run build     # Build assets
${config.packageManager} run deploy    # Deploy to Shopify
\`\`\`
`;

  await mkdir('.claude', { recursive: true });
  await writeFile('.claude/CLAUDE.md', _projectClaudeMd);
  log('Created: .claude/CLAUDE.md', colors.green);

  // frontend/CLAUDE.md - Frontend development guide
  const _frontendClaudeMd = `# Frontend Development Guide

## Custom Element Pattern

All section components are Custom Elements that extend \`HTMLElement\`.

### Basic Structure

\`\`\`${config.jsApproach === 'typescript' ? 'typescript' : 'javascript'}
export class MySection extends HTMLElement {
  // Cache DOM references (prefix with _)
  _container = null;
  _button = null;

  // State (prefix with _)
  _isInitialized = false;
  _isLoading = false;

  // Lifecycle: element added to DOM
  connectedCallback() {
    if (this._isInitialized) return;
    this._init();
  }

  // Lifecycle: element removed from DOM
  disconnectedCallback() {
    this._destroy();
  }

  _init() {
    this._cacheElements();
    if (!this._container) return; // Guard clause
    this._bindEvents();
    this._isInitialized = true;
  }

  _cacheElements() {
    this._container = this.querySelector('.my-section__container');
    this._button = this.querySelector('.my-section__button');
  }

  _bindEvents() {
    this._button?.addEventListener('click', this._handleClick);
  }

  _destroy() {
    this._button?.removeEventListener('click', this._handleClick);
    this._container = null;
    this._button = null;
    this._isInitialized = false;
  }

  // Arrow function to preserve 'this'
  _handleClick = (event) => {
    const _target = event.target;
    if (!_target) return;
    // Handle click
  };
}
\`\`\`

### Registration

Register in \`sectionRegistry.${config.jsApproach === 'typescript' ? 'ts' : 'js'}\`:

\`\`\`${config.jsApproach === 'typescript' ? 'typescript' : 'javascript'}
import { MySection } from '@/components/sections/my-section';

registerSection('my-section', 'my-section', MySection, {
  onBlockSelect: (event) => {
    // Scroll to selected block in Theme Editor
  },
});
\`\`\`

### Liquid Template

\`\`\`liquid
<my-section
  data-section-id="{{ section.id }}"
  data-section-type="my-section"
  data-config='{ "autoplay": {{ section.settings.autoplay }} }'
>
  <div class="my-section__container">
    {% for block in section.blocks %}
      <div class="my-section__item" {{ block.shopify_attributes }}>
        ...
      </div>
    {% endfor %}
  </div>
</my-section>
\`\`\`

---

## Theme Editor Integration

The Section Registry handles these Shopify events:

| Event | When Fired |
|-------|------------|
| \`shopify:section:load\` | Section added or settings changed |
| \`shopify:section:unload\` | Section removed |
| \`shopify:section:select\` | Section clicked in editor |
| \`shopify:section:deselect\` | Section deselected |
| \`shopify:block:select\` | Block clicked in editor |
| \`shopify:block:deselect\` | Block deselected |

Use callbacks when registering:

\`\`\`${config.jsApproach === 'typescript' ? 'typescript' : 'javascript'}
registerSection('featured-collection', 'featured-collection', FeaturedCollection, {
  onBlockSelect: (event) => {
    const _blockId = event.detail.blockId;
    // Scroll to block, highlight it, open accordion, etc.
  },
  onBlockDeselect: (event) => {
    // Remove highlight
  },
});
\`\`\`

---

## Styling${config.stylingApproach === 'scss' ? ' (SCSS)' : config.stylingApproach === 'tailwind' ? ' (Tailwind @apply)' : ' (CSS)'}

### Mobile-First

Always start with mobile styles, use media queries for larger screens.

${config.stylingApproach === 'scss' ? `\`\`\`scss
.product-card {
  padding: spacing('sm');  // Mobile

  @include min('md') {
    padding: spacing('md');  // Tablet+
  }

  @include min('lg') {
    padding: spacing('lg');  // Desktop+
  }
}
\`\`\`` : config.stylingApproach === 'tailwind' ? `\`\`\`css
/* Use @apply in CSS files, NOT inline in Liquid */
.product-card {
  @apply p-2;  /* Mobile */

  @screen md {
    @apply p-4;  /* Tablet+ */
  }

  @screen lg {
    @apply p-8;  /* Desktop+ */
  }
}
\`\`\`` : `\`\`\`css
.product-card {
  padding: var(--spacing-sm);  /* Mobile */
}

@media (min-width: 768px) {
  .product-card {
    padding: var(--spacing-md);  /* Tablet+ */
  }
}

@media (min-width: 1024px) {
  .product-card {
    padding: var(--spacing-lg);  /* Desktop+ */
  }
}
\`\`\``}

### BEM Naming

\`\`\`${config.stylingApproach === 'scss' ? 'scss' : 'css'}
.product-card {           /* Block */
  &__image { }            /* Element */
  &__title { }
  &__price { }
  &--featured { }         /* Modifier */
  &.is-loading { }        /* State */
}
\`\`\`

---

## Pre-Flight Checklist

Before committing:

- [ ] Custom Element has \`connectedCallback\` and \`disconnectedCallback\`
- [ ] All event listeners are removed in \`disconnectedCallback\`
- [ ] Guard clauses used for early returns
- [ ] Variables prefixed with \`_\` (function scope)
- [ ] Logging uses \`consoleMessage()\`
- [ ] Mobile-first styles
- [ ] Tested in Theme Editor (block select/deselect)
`;

  await writeFile('frontend/CLAUDE.md', _frontendClaudeMd);
  log('Created: frontend/CLAUDE.md', colors.green);
}

async function createAgents(config: SetupConfig): Promise<void> {
  header('Creating Claude Agents');

  // ui-design agent
  const _uiDesignAgent = `# UI Design Agent

You are a UI/UX design specialist for Shopify theme development.

## Expertise

- ${config.stylingApproach === 'scss' ? 'SCSS with design tokens and mixins' : config.stylingApproach === 'tailwind' ? 'Tailwind CSS using @apply directives (NOT inline utilities)' : 'CSS with custom properties'}
- Mobile-first responsive design
- BEM naming conventions
- Semantic class names (no utility classes in markup)
- Animation with CSS transitions (respect prefers-reduced-motion)
- Color accessibility (WCAG contrast ratios)

## Key Rules

1. **Mobile-first**: Always start with mobile styles
2. **Semantic names**: \`.product-card__title\` not \`.text-lg.font-bold\`
3. **State classes**: Use \`.is-active\`, \`.is-loading\`, \`.is-hidden\`
4. **Animations**: CSS transitions only, respect reduced motion
5. **Performance**: Avoid animating width/height, use transform/opacity

${config.stylingApproach === 'scss' ? `## SCSS Patterns

\`\`\`scss
// Use design tokens
.component {
  padding: spacing('md');
  color: color('text');
  transition: transition('base');

  @include min('md') {
    padding: spacing('lg');
  }
}
\`\`\`` : config.stylingApproach === 'tailwind' ? `## Tailwind @apply Patterns

\`\`\`css
/* CORRECT: @apply in CSS files */
.product-card {
  @apply flex flex-col gap-4 p-4;
  @apply bg-white rounded-lg shadow-sm;
  @apply transition-shadow duration-200;
}

/* WRONG: Inline utilities in Liquid */
<div class="flex flex-col gap-4 p-4">  <!-- NO -->
\`\`\`` : `## CSS Patterns

\`\`\`css
.component {
  padding: var(--spacing-md);
  transition: var(--transition-base);
}

@media (min-width: 768px) {
  .component {
    padding: var(--spacing-lg);
  }
}
\`\`\``}

## Reduced Motion

\`\`\`${config.stylingApproach === 'scss' ? 'scss' : 'css'}
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: none;
    transition: none;
  }
}
\`\`\`
`;

  await writeFile('.claude/agents/ui-design.md', _uiDesignAgent);
  log('Created: .claude/agents/ui-design.md', colors.green);

  // code-writer agent
  const _codeWriterAgent = `# Code Writer Agent

You are a ${config.jsApproach === 'typescript' ? 'TypeScript' : 'JavaScript'} specialist for Shopify theme development.

## Expertise

- Custom Elements (Web Components)
- Section Registry pattern
- Shopify Theme Editor integration
- Event-driven architecture
- Performance optimization

## Key Rules

### Naming
- Prefix function-scoped variables: \`_element\`, \`_data\`, \`_config\`
- PascalCase for classes: \`FeaturedCollection\`
- camelCase for methods: \`handleClick\`

### Early Returns
\`\`\`${config.jsApproach === 'typescript' ? 'typescript' : 'javascript'}
// CORRECT
_handleClick(event) {
  const _target = event.target;
  if (!_target) return;
  if (!_target.dataset.id) return;

  // Main logic
}

// WRONG - too nested
_handleClick(event) {
  if (event.target) {
    if (event.target.dataset.id) {
      // Main logic
    }
  }
}
\`\`\`

### Custom Element Structure
\`\`\`${config.jsApproach === 'typescript' ? 'typescript' : 'javascript'}
export class MyComponent extends HTMLElement {
  _container = null;
  _isInitialized = false;

  connectedCallback() {
    if (this._isInitialized) return;
    this._init();
  }

  disconnectedCallback() {
    this._destroy();
  }

  _init() {
    this._cacheElements();
    this._bindEvents();
    this._isInitialized = true;
  }

  _destroy() {
    // MUST remove all event listeners
    this._container = null;
    this._isInitialized = false;
  }

  // Arrow function preserves 'this'
  _handleClick = (event) => { };
}
\`\`\`

### Logging
- ALWAYS use \`consoleMessage()\` from \`@/utils\`
- NEVER use \`console.log\` directly

### Events
- Dispatch: \`dispatchStoreEvent('cart:updated', { count: 5 })\`
- Subscribe: \`subscribeToStoreEvent('cart:updated', handler)\`
`;

  await writeFile('.claude/agents/code-writer.md', _codeWriterAgent);
  log('Created: .claude/agents/code-writer.md', colors.green);

  // liquid agent
  const _liquidAgent = `# Liquid Agent

You are a Shopify Liquid template specialist.

## Expertise

- Liquid syntax and filters
- Section and block architecture
- Schema configuration
- Metafields and metaobjects
- Performance optimization

## Key Rules

### Section Structure
\`\`\`liquid
{% comment %} sections/my-section.liquid {% endcomment %}

<my-section
  data-section-id="{{ section.id }}"
  data-section-type="my-section"
  data-config='{ "setting": {{ section.settings.value | json }} }'
>
  <div class="my-section">
    {% for block in section.blocks %}
      {%- case block.type -%}
        {%- when 'item' -%}
          <div class="my-section__item" {{ block.shopify_attributes }}>
            {{ block.settings.title }}
          </div>
      {%- endcase -%}
    {% endfor %}
  </div>
</my-section>

{% schema %}
{
  "name": "My Section",
  "settings": [],
  "blocks": [
    {
      "type": "item",
      "name": "Item",
      "settings": [
        {
          "type": "text",
          "id": "title",
          "label": "Title"
        }
      ]
    }
  ],
  "presets": [
    {
      "name": "My Section"
    }
  ]
}
{% endschema %}
\`\`\`

### Custom Element Tags
- Use Custom Element tag as section wrapper
- Include \`data-section-id\` and \`data-section-type\`
- Pass config via \`data-config\` JSON attribute
- Add \`{{ block.shopify_attributes }}\` to blocks for Theme Editor

### Performance
- Avoid N+1 queries in loops
- Use \`| json\` filter for JS data
- Lazy load images with \`loading="lazy"\`
- Use Shopify's image_url for responsive images

### Image Optimization
\`\`\`liquid
{{ image | image_url: width: 800 | image_tag:
  loading: 'lazy',
  widths: '375, 750, 1100, 1500',
  sizes: '(min-width: 1024px) 50vw, 100vw'
}}
\`\`\`
`;

  await writeFile('.claude/agents/liquid.md', _liquidAgent);
  log('Created: .claude/agents/liquid.md', colors.green);

  // accessibility agent
  const _accessibilityAgent = `# Accessibility Agent

You are a web accessibility specialist for Shopify themes.

## Expertise

- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader compatibility
- Focus management
- ARIA attributes

## Key Rules

### Focus Management
\`\`\`${config.jsApproach === 'typescript' ? 'typescript' : 'javascript'}
// Trap focus in modals
_trapFocus(container) {
  const _focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const _first = _focusable[0];
  const _last = _focusable[_focusable.length - 1];

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;

    if (event.shiftKey && document.activeElement === _first) {
      event.preventDefault();
      _last.focus();
    } else if (!event.shiftKey && document.activeElement === _last) {
      event.preventDefault();
      _first.focus();
    }
  });
}
\`\`\`

### Interactive Elements
- All interactive elements must be keyboard accessible
- Provide visible focus states (\`:focus-visible\`)
- Buttons for actions, links for navigation
- Never remove focus outline without replacement

### ARIA
\`\`\`html
<!-- Expandable content -->
<button aria-expanded="false" aria-controls="content-id">
  Toggle
</button>
<div id="content-id" hidden>Content</div>

<!-- Live regions for dynamic updates -->
<div aria-live="polite" aria-atomic="true">
  Cart updated: 5 items
</div>
\`\`\`

### Reduced Motion
\`\`\`${config.stylingApproach === 'scss' ? 'scss' : 'css'}
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
\`\`\`

### Color Contrast
- Text must have 4.5:1 contrast ratio (AA)
- Large text (18px+) can have 3:1 ratio
- Never convey information by color alone

### Forms
- All inputs need visible labels
- Error messages must be associated with inputs
- Use \`aria-describedby\` for help text
- Group related inputs with fieldset/legend
`;

  await writeFile('.claude/agents/accessibility.md', _accessibilityAgent);
  log('Created: .claude/agents/accessibility.md', colors.green);
}

// =============================================================================
// THEME OPERATIONS
// =============================================================================

async function pullTheme(config: SetupConfig): Promise<void> {
  if (!config.themeId) {
    log('\nSkipping theme pull - no theme selected', colors.yellow);
    return;
  }

  header('Pulling Shopify Theme');

  try {
    log(`Pulling theme ${config.themeId}...`, colors.cyan);
    await $`shopify theme pull --theme ${config.themeId} --environment ${config.environmentName}`;
    log('Theme pulled successfully', colors.green);

    // Scan theme for events
    const _scanResult = await scanThemeForEvents('.');
    displayThemeScanResults(_scanResult);
  } catch (_error) {
    log('Error pulling theme', colors.red);
    console.error(_error);
  }
}

async function runInitialBuild(config: SetupConfig): Promise<void> {
  header('Running Initial Build');

  try {
    log('Building assets...', colors.cyan);

    if (config.packageManager === 'bun') {
      await $`bun run build`;
    } else {
      await $`yarn build`;
    }

    log('Build completed successfully', colors.green);
  } catch (_error) {
    log('Build failed - you may need to fix errors first', colors.yellow);
  }
}

// =============================================================================
// FINALIZATION
// =============================================================================

function displayNextSteps(config: SetupConfig): void {
  header('Setup Complete!');

  log('Your Shopify theme development environment is ready.\n', colors.green);

  log('Next steps:', colors.bright);
  console.log();

  log('1. Start development:', colors.cyan);
  log(`   ${config.packageManager} run dev`, colors.yellow);
  console.log();

  log('2. Build assets:', colors.cyan);
  log(`   ${config.packageManager} run build`, colors.yellow);
  console.log();

  log('3. Deploy to Shopify:', colors.cyan);
  log(`   ${config.packageManager} run deploy`, colors.yellow);
  console.log();

  log('4. Read the documentation:', colors.cyan);
  log('   - .claude/CLAUDE.md (project rules)', colors.dim);
  log('   - frontend/CLAUDE.md (frontend guide)', colors.dim);
  console.log();

  log('Happy coding!', colors.green + colors.bright);
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  try {
    const _config = await askQuestions();

    // Confirmation
    subheader('Configuration Summary');
    log(`Project: ${_config.projectName}`, colors.cyan);
    log(`Styling: ${_config.stylingApproach}`, colors.cyan);
    log(`JavaScript: ${_config.jsApproach}`, colors.cyan);
    log(`Package Manager: ${_config.packageManager}`, colors.cyan);
    log(`Store: ${_config.storeUrl || '(not configured)'}`, colors.cyan);
    log(`Theme: ${_config.themeId || '(not selected)'}`, colors.cyan);
    console.log();

    const _confirm = await prompt('Proceed with setup? (y/n):');
    if (_confirm.toLowerCase() !== 'y' && _confirm.toLowerCase() !== 'yes') {
      log('Setup cancelled.', colors.yellow);
      process.exit(0);
    }

    // Run setup
    await createPackageJson(_config);
    await installDependencies(_config);
    await createDirectoryStructure(_config);
    await createViteConfig(_config);
    await createPostCSSConfig(_config);
    await createTailwindConfig(_config);
    await createTypeScriptConfig(_config);
    await createShopifyThemeToml(_config);
    await createGitIgnore();
    await createShopifyIgnore();
    await createGitHubWorkflow(_config);
    await createEntrypoints(_config);
    await createUtilities(_config);
    await createConstants(_config);
    await createSectionRegistry(_config);
    await createExampleSection(_config);
    await createClaudeMd(_config);
    await createAgents(_config);
    await pullTheme(_config);
    await runInitialBuild(_config);

    displayNextSteps(_config);
  } catch (_error) {
    log('\nSetup failed:', colors.red);
    console.error(_error);
    process.exit(1);
  } finally {
    _rl.close();
  }
}

main();
