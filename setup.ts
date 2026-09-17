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

const GITIGNORE_TEMPLATE = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Environment variables
.env
.env.local
.env.*.local

# Vite
dist/
dist-ssr/
*.local
.vite/
# The Vite manifest must be committed: vite.config.js reads it to delete the
# previous build's hashed assets, and CI has no other record of them.
!assets/.vite/

# Editor directories and files
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
.idea/
*.suo
*.sw?

# OS files
.DS_Store
Thumbs.db
*~
.Spotlight-V100
.Trashes

# Shopify
# config/settings_data.json is deliberately NOT ignored: Shopify's GitHub
# integration commits theme-editor changes back to the branch, so ignoring it
# would drop merchant settings on the next push.
shopify.theme.toml
.shopify/

# Build artifacts
*.log
*.tsbuildinfo

# Caches
.eslintcache
.cache
coverage
*.lcov

# Yarn 4 — node-modules linker, so no PnP files are expected.
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
.pnp.*

# Lock files (Yarn only; yarn.lock is committed)
package-lock.json
bun.lock
bun.lockb
pnpm-lock.yaml
`;

const SHOPIFYIGNORE_TEMPLATE = `# Files excluded from Shopify theme uploads.
# Only compiled output in assets/ ships; frontend/ is the source of truth.
# Patterns are globs — a bare directory name does not match, so each entry
# needs an explicit /* or /**.

node_modules/**
frontend/**
dist/**

# Scratch space for reference copies of the theme — never uploaded.
initial build/**
.github/**
.claude/**
.shopify/**
.yarn/**
.vscode/**
.idea/**

# Vite writes its build manifest here; Shopify rejects subfolders under assets/.
assets/.vite/**

vite.config.js
postcss.config.js
eslint.config.js
tsconfig.json
package.json
setup.ts
bun.lock
bun.lockb
package-lock.json
yarn.lock
pnpm-lock.yaml
.yarnrc.yml
.pnp.*

*.md
.env*
shopify.theme.toml
example.shopify.theme.toml

.DS_Store
Thumbs.db
`;

// =============================================================================
// TYPES
// =============================================================================

interface SetupConfig {
  projectName: string;
  projectNameSafe: string; // For window object (no hyphens)
  /** Prefix for every custom Liquid file, e.g. 'refuge' -> snippets/refuge-card.liquid. */
  namespace: string;
  /** Existing live theme to preserve, or a fresh base theme. */
  themeSource: 'existing' | 'new';
  /**
   * Whether Shopify's GitHub integration owns main/staging/qa. This decides
   * whether config/settings_data.json is tracked and what CI does with assets.
   */
  githubIntegration: boolean;
  storeUrl: string;
  storePassword: string;
  /** Storefront password, for password-protected stores. Not the access token. */
  storefrontPassword: string;
  environmentName: string;
  themeId: string | null;
  // Fixed: every project converged on these, and keeping the alternatives alive
  // meant the generated code was never good at any of them.
  stylingApproach: 'scss';
  jsApproach: 'typescript';
  packageManager: 'yarn';
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

/**
 * Reads answers from a JSON file instead of prompting.
 *
 * Needed because readline drops piped stdin under Bun, so `setup.ts < answers`
 * silently stalls — which made the script impossible to drive non-interactively
 * even though the docs told agents to run it.
 *
 *   bun setup.ts --config setup.config.json
 */
async function loadConfigFile(path: string): Promise<SetupConfig> {
  const _raw = await Bun.file(path).text();
  const _parsed = JSON.parse(_raw) as Partial<SetupConfig>;

  const _required: (keyof SetupConfig)[] = ['projectName', 'namespace', 'storeUrl'];
  const _missing = _required.filter((_key) => !_parsed[_key]);
  if (_missing.length > 0) {
    throw new Error(`Config file is missing required keys: ${_missing.join(', ')}`);
  }

  return {
    projectNameSafe: String(_parsed.projectName).replace(/[-\s]/g, '_').toLowerCase(),
    themeSource: 'existing',
    githubIntegration: true,
    storePassword: '',
    storefrontPassword: '',
    environmentName: 'development',
    themeId: null,
    ..._parsed,
  } as SetupConfig;
}

async function askQuestions(): Promise<SetupConfig> {
  header('Shopify Theme Development Setup');

  log('Vite + TypeScript + SCSS on Yarn 4.', colors.green);
  log('Read the Decisions section of project_setup.md before answering.\n', colors.dim);

  const _projectName = await prompt('Project name (e.g. acme-store):');
  if (!_projectName || _projectName.trim() === '') {
    log('Project name is required.', colors.red);
    process.exit(1);
  }

  const _projectNameSafe = _projectName.replace(/[-\s]/g, '_').toLowerCase();

  // Decision 4 — the prefix every custom Liquid file carries. Renaming it later
  // touches every {% render %} call, so it is asked up front.
  subheader('Namespace');
  log('Every custom Liquid file is prefixed with this, so a base-theme upgrade', colors.dim);
  log('can be applied by overwriting every file that lacks it.\n', colors.dim);

  const _namespace =
    (await prompt(`Namespace prefix (default: ${_projectNameSafe.split('_')[0]}):`)) ||
    _projectNameSafe.split('_')[0];

  // Decision 1 — decides what the baseline commit means.
  subheader('Starting point');
  const _sourceChoice = await select('Is this a new build or an existing theme?', [
    'Existing live theme (pull it first and commit it untouched)',
    'Brand new build (start from a clean base theme)',
  ]);
  const _themeSource: SetupConfig['themeSource'] = _sourceChoice === 0 ? 'existing' : 'new';

  // Decision 3 — the one people get wrong, and it destroys merchant data.
  subheader('Deployment');
  log('If Shopify\'s GitHub integration syncs main/staging/qa, then', colors.dim);
  log('config/settings_data.json MUST be tracked: Shopify commits theme-editor', colors.dim);
  log('changes back to the branch, and ignoring it wipes merchant settings.\n', colors.dim);

  const _integrationChoice = await select('Is the GitHub integration connected?', [
    'Yes - Shopify syncs branches (track settings_data.json, CI commits assets)',
    'No - CLI-driven only (ignore settings_data.json, CI just verifies)',
  ]);
  const _githubIntegration = _integrationChoice === 0;

  subheader('Shopify Store');
  const _storeInput = await prompt('Store URL or admin URL:');
  const _normalizedStoreUrl = parseStoreUrl(_storeInput);

  log('\nTheme access token (shptka_...) from Settings -> Apps -> Develop apps.', colors.dim);
  const _storePassword = await prompt('Theme access token:');

  log('\nStorefront password, only if the store is password-protected.', colors.dim);
  log('This is NOT the access token - they are different credentials.', colors.dim);
  const _storefrontPassword = await prompt('Storefront password (blank if none):');

  const _environmentName = (await prompt('Environment name (default: development):')) || 'development';

  let _themeId: string | null = null;

  if (_normalizedStoreUrl && _storePassword) {
    log('\nFetching themes...', colors.cyan);
    const _themes = await getShopifyThemes(_normalizedStoreUrl, _storePassword);

    if (_themes.length > 0) {
      const _themeOptions = _themes.map((_t) => `${_t.name} (${_t.role}) - ID: ${_t.id}`);
      _themeOptions.push('Skip - configure later');

      const _label =
        _themeSource === 'existing'
          ? 'Which theme is live? (it will be pulled as the baseline)'
          : 'Which theme should the dev environment target?';

      const _themeChoice = await select(_label, _themeOptions);
      if (_themeChoice < _themes.length) {
        _themeId = _themes[_themeChoice].id;
        log(`\nSelected: ${_themes[_themeChoice].name}`, colors.green);
      }
    } else {
      log('Could not fetch themes. Set the theme id in shopify.theme.toml later.', colors.yellow);
    }
  }

  return {
    projectName: _projectName,
    projectNameSafe: _projectNameSafe,
    namespace: _namespace,
    themeSource: _themeSource,
    githubIntegration: _githubIntegration,
    storeUrl: _normalizedStoreUrl,
    storePassword: _storePassword,
    storefrontPassword: _storefrontPassword,
    environmentName: _environmentName,
    themeId: _themeId,
    stylingApproach: 'scss',
    jsApproach: 'typescript',
    packageManager: 'yarn',
  };
}

// =============================================================================
// FILE GENERATORS
// =============================================================================

async function createDirectoryStructure(config: SetupConfig): Promise<void> {
  header('Creating Directory Structure');

  const _dirs = [
    '.claude/agents',
    'frontend/entrypoints',
    'frontend/scripts/components/sections',
    'frontend/scripts/components/shared',
    'frontend/scripts/core',
    'frontend/scripts/types',
    'frontend/scripts/constants',
    'frontend/scripts/utils',
    'frontend/styles/utils',
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

  // Scripts are only generated for the dev environment. A deploy:staging that
  // targets a Shopify-managed theme competes with the GitHub integration.
  const _packageJson = {
    name: `${config.projectName}-theme`,
    version: '1.0.0',
    type: 'module',
    packageManager: 'yarn@4.18.0',
    engines: { node: '>=20' },
    scripts: {
      dev: 'run-p -sr "shopify:dev" "vite:dev" --',
      build: 'vite build',
      deploy: 'run-s "build" "push" --',
      push: `shopify theme push --environment ${config.environmentName}`,
      pull: `shopify theme pull --environment ${config.environmentName}`,
      'shopify:dev': `shopify theme dev --environment ${config.environmentName} --live-reload=hot-reload --port=\${SHOPIFY_PORT:-9292}`,
      'vite:dev': 'vite --port ${VITE_PORT:-5173}',
      'vite:build': 'vite build',
      'type-check': 'tsc --noEmit',
      lint: 'eslint frontend',
      clean: 'rm -rf dist assets/storefront-*.js assets/styles-*.css assets/.vite',
    },
  };

  await writeFile('package.json', JSON.stringify(_packageJson, null, 2) + '\n');
  log('Created: package.json', colors.green);
}

async function createYarnRc(): Promise<void> {
  header('Configuring Yarn');

  await writeFile(
    '.yarnrc.yml',
    `# PnP breaks the Shopify CLI and vite-plugin-shopify, both of which resolve
# and spawn binaries from a real node_modules tree.
nodeLinker: node-modules

enableGlobalCache: true
`
  );
  log('Created: .yarnrc.yml', colors.green);
}

async function installDependencies(): Promise<void> {
  header('Installing Dependencies');

  // typescript and eslint are pinned: @typescript-eslint 8 does not support
  // TypeScript 7, and TypeScript 7 rejects the tsconfig baseUrl the path aliases
  // rely on. autoprefixer is what postcss.config.js loads.
  const _deps = [
    'vite',
    'vite-plugin-shopify',
    'typescript@^5',
    '@types/node',
    'sass',
    'eslint@^9',
    '@eslint/js@^9',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
    'globals',
    'npm-run-all',
    'postcss',
    'autoprefixer',
  ];

  try {
    // Corepack resolves the version pinned in packageManager, so the toolchain
    // lives in the repo rather than on whatever each machine has installed.
    await $`corepack enable`;
    await $`yarn add -D ${_deps}`;
    log('Dependencies installed successfully', colors.green);
  } catch (_error) {
    log('Error installing dependencies', colors.red);
    console.error(_error);
  }
}

async function createViteConfig(config: SetupConfig): Promise<void> {
  header('Creating Vite Configuration');

  const _scssPreprocessor = `
    preprocessorOptions: {
      scss: {
        // Lets partials say \`@use 'utils' as u\` instead of counting ../ hops.
        loadPaths: ['frontend/styles'],
        api: 'modern-compiler',
        quietDeps: true,
        logger: {
          warn: () => { }
        }
      }
    }`;

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

async function createPostCSSConfig(): Promise<void> {
  const _postcssConfig = `export default {
  plugins: {
    autoprefixer: {},
  },
}
`;

  await writeFile('postcss.config.js', _postcssConfig);
  log('Created: postcss.config.js', colors.green);
}

async function createTypeScriptConfig(): Promise<void> {
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
      types: ['vite/client', 'node'],
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

async function createGitIgnore(config: SetupConfig): Promise<void> {
  header('Creating .gitignore');

  // config/settings_data.json is only safe to ignore when Shopify's GitHub
  // integration is NOT connected. When it is, Shopify commits theme-editor
  // changes back to the branch, and ignoring the file drops merchant settings
  // on the next push.
  const _settingsData = config.githubIntegration
    ? ''
    : '\n# No GitHub integration, so theme settings are not synced through Git.\nconfig/settings_data.json\n';

  await writeFile('.gitignore', GITIGNORE_TEMPLATE + _settingsData);
  log('Created: .gitignore', colors.green);

  if (config.githubIntegration) {
    log('  settings_data.json left TRACKED (GitHub integration is connected)', colors.dim);
  }
}

async function createShopifyIgnore(): Promise<void> {
  header('Creating .shopifyignore');

  await writeFile('.shopifyignore', SHOPIFYIGNORE_TEMPLATE);
  log('Created: .shopifyignore', colors.green);
}

async function createGitHubWorkflow(config: SetupConfig): Promise<void> {
  header('Creating GitHub Actions workflow');

  // When Shopify syncs a branch, CI has to COMMIT the built assets back to it —
  // that commit is what Shopify deploys. Without the integration, CI only needs
  // to verify the committed assets match the source.
  const _assetStep = config.githubIntegration
    ? `      - name: Commit built assets
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
            git push origin HEAD:\${{ github.ref_name }} && exit 0
            git fetch origin \${{ github.ref_name }}
            # In a rebase 'theirs' is the commit being replayed - the assets this
            # run just built, the correct winner for generated output.
            git rebase -X theirs origin/\${{ github.ref_name }} || {
              git rebase --abort; exit 1;
            }
          done
          exit 1

      - name: Verify assets are in sync (PR)
        if: github.event_name == 'pull_request'
        run: git diff --exit-code assets/ snippets/vite-tag.liquid`
    : `      - name: Verify assets are in sync
        run: |
          git diff --exit-code assets/ snippets/vite-tag.liquid || {
            echo "Built assets are out of sync. Run 'yarn build' and commit."
            exit 1
          }`;

  const _workflow = `name: Build

on:
  push:
    branches: [main, staging, qa]
  pull_request:
    branches: [main, staging, qa]

# Assets derive entirely from source, so only the newest push per branch is worth
# building. Cancelling superseded runs also stops two of them racing to push their
# asset commit, which leaves one rejected with "fetch first".
concurrency:
  group: build-\${{ github.ref }}
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

      # Corepack must run before any yarn call. setup-node's built-in yarn cache
      # runs earlier and would probe the runner's preinstalled Yarn 1.
      - run: corepack enable

      - id: yarn-cache
        run: echo "dir=\$(yarn config get cacheFolder)" >> "\$GITHUB_OUTPUT"

      - uses: actions/cache@v4
        with:
          path: \${{ steps.yarn-cache.outputs.dir }}
          key: yarn-\${{ runner.os }}-\${{ hashFiles('yarn.lock') }}
          restore-keys: yarn-\${{ runner.os }}-

      - run: yarn install --immutable
      - run: yarn type-check
      - run: yarn lint
      - run: yarn build

${_assetStep}
`;

  await writeFile('.github/workflows/build.yml', _workflow);
  log('Created: .github/workflows/build.yml', colors.green);
}

// =============================================================================
// FRONTEND FILES
// =============================================================================

function toPascalCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((_part) => _part[0].toUpperCase() + _part.slice(1))
    .join('');
}

async function createEslintConfig(): Promise<void> {
  header('Creating ESLint Configuration');

  const _config = `import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['assets/**', 'dist/**', 'node_modules/**', '.yarn/**'] },
  js.configs.recommended,
  {
    files: ['frontend/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: globals.browser,
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_$' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // consoleMessage() is the sanctioned logging wrapper, so it owns the console calls.
    files: ['frontend/scripts/utils/index.ts'],
    rules: { 'no-console': 'off' },
  },
];
`;

  await writeFile('eslint.config.js', _config);
  log('Created: eslint.config.js', colors.green);
}

async function createStyleHelpers(): Promise<void> {
  header('Creating SCSS Helpers');

  const _unit = `@use 'sass:list';
@use 'sass:math';
@use 'sass:meta';

$base-font-size: 16 !default;

@function strip-unit($value) {
  @if meta.type-of($value) == 'number' and not math.is-unitless($value) {
    @return math.div($value, ($value * 0 + 1));
  }

  @return $value;
}

/// rem(16) -> 1rem. Accepts a list: rem(16 24) -> 1rem 1.5rem.
@function rem($values) {
  $result: ();

  @each $value in $values {
    @if meta.type-of($value) == 'number' {
      $value: math.div(strip-unit($value), $base-font-size) * 1rem;
    }

    $result: list.append($result, $value);
  }

  @if list.length($result) == 1 {
    @return list.nth($result, 1);
  }

  @return $result;
}

@function rem-calc($values) {
  @return rem($values);
}
`;

  const _vwCalc = `@use 'sass:list';
@use 'sass:math';
@use 'sass:meta';
@use './unit' as unit;

$min-viewport: 390 !default;
$max-viewport: 1728 !default;

/// Fluid size that scales linearly with the viewport and clamps at both ends.
/// fluid(16, 32) -> 16px at 390px wide, 32px at 1728px wide.
/// A three-value list is accepted for parity with older call sites; the middle
/// value is the midpoint reference only and does not bend the curve.
@function fluid($min, $max: null) {
  @if $max == null {
    @if meta.type-of($min) != 'list' {
      @error 'fluid() needs a min and max, or a list of sizes.';
    }

    $max: list.nth($min, list.length($min));
    $min: list.nth($min, 1);
  }

  $min-px: unit.strip-unit($min);
  $max-px: unit.strip-unit($max);

  $slope: math.div($max-px - $min-px, $max-viewport - $min-viewport);
  $intercept: $min-px - $slope * $min-viewport;

  @return clamp(
    #{unit.rem($min-px)},
    #{unit.rem($intercept)} + #{$slope * 100}vw,
    #{unit.rem($max-px)}
  );
}
`;

  const _mq = `@use 'sass:map';

$breakpoints: (
  'sm': 640px,
  'md': 768px,
  'lg': 1024px,
  'xl': 1280px,
  'xxl': 1440px,
) !default;

@function breakpoint($name) {
  @if not map.has-key($breakpoints, $name) {
    @error 'Breakpoint "#{$name}" not found. Available: #{map.keys($breakpoints)}.';
  }

  @return map.get($breakpoints, $name);
}

@mixin min($name) {
  @media screen and (min-width: #{breakpoint($name)}) {
    @content;
  }
}

@mixin max($name) {
  @media screen and (max-width: #{breakpoint($name) - 0.02px}) {
    @content;
  }
}

@mixin between($min, $max) {
  @media screen and (min-width: #{breakpoint($min)}) and (max-width: #{breakpoint($max) - 0.02px}) {
    @content;
  }
}

@mixin reduced-motion {
  @media (prefers-reduced-motion: reduce) {
    @content;
  }
}
`;

  const _tokens = `@use 'sass:map';
@use './unit' as unit;
@use './vw-calc' as vw;

$colors: (
  'primary': rgb(var(--color-button)),
  'secondary': rgb(var(--color-accent)),
  'text': #1a1a1a,
  'text-muted': #666666,
  'surface': #ffffff,
  'border': #e5e5e5,
) !default;

// Small steps stay fixed; anything big enough to affect layout rhythm scales
// with the viewport so a section is not padded the same on a phone and a 27".
$spacing: (
  'xs': unit.rem(4),
  'sm': unit.rem(8),
  'md': unit.rem(16),
  'lg': vw.fluid(24, 40),
  'xl': vw.fluid(40, 80),
  'xxl': vw.fluid(64, 128),
) !default;

$transitions: (
  'fast': 150ms ease,
  'base': 250ms ease,
  'slow': 400ms ease,
) !default;

$radii: (
  'sm': unit.rem(4),
  'md': unit.rem(8),
  'lg': unit.rem(16),
  'pill': 999px,
) !default;

@function color($key) {
  @return map.get($colors, $key);
}

@function spacing($key) {
  @return map.get($spacing, $key);
}

@function transition($key) {
  @return map.get($transitions, $key);
}

@function radius($key) {
  @return map.get($radii, $key);
}
`;

  const _index = `@forward './unit';
@forward './vw-calc';
@forward './mq';
@forward './tokens';
`;

  await writeFile('frontend/styles/utils/_unit.scss', _unit);
  await writeFile('frontend/styles/utils/_vw-calc.scss', _vwCalc);
  await writeFile('frontend/styles/utils/_mq.scss', _mq);
  await writeFile('frontend/styles/utils/_tokens.scss', _tokens);
  await writeFile('frontend/styles/utils/_index.scss', _index);

  log('Created: frontend/styles/utils/ (unit, vw-calc, mq, tokens)', colors.green);
}

async function createEntrypoints(config: SetupConfig): Promise<void> {
  header('Creating Entry Points');

  const _g = config.projectNameSafe;

  const _types = `export type LiquidRoutes = Record<
  'cart' | 'cartAdd' | 'cartChange' | 'cartUpdate' | 'predictiveSearch',
  string
>;

export type LiquidBootstrap = {
  readonly devMode: boolean;
  readonly routes: LiquidRoutes;
  readonly cart: { count: number; total: number };
};

export type StorefrontGlobal = {
  settings: {
    devMode: boolean;
    debugEvents: boolean;
  };
  theme: {
    shopName: string;
    currency: string;
    moneyFormat: string;
  };
  routes: LiquidRoutes;
  cart: {
    count: number;
    total: number;
  };
  events: EventTarget;
  version: string;
};

export type ShopifySectionEvent = CustomEvent<{ sectionId: string; load: boolean }>;

export type ShopifyBlockEvent = CustomEvent<{
  blockId: string;
  sectionId: string;
  load: boolean;
}>;

declare global {
  interface Window {
    ${_g}: StorefrontGlobal;
    ${_g}Settings?: LiquidBootstrap;
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
`;

  await writeFile('frontend/scripts/types/index.ts', _types);
  log('Created: frontend/scripts/types/index.ts', colors.green);

  const _global = `import type { StorefrontGlobal } from '@/types';

const _bootstrap = window.${_g}Settings;

// Must run before any section module is imported: elements upgrade the moment
// they are defined, and consoleMessage() reads window.${_g} during that first
// upgrade.
window.${_g} = {
  settings: {
    devMode: _bootstrap?.devMode ?? import.meta.env.DEV,
    debugEvents: false,
  },
  theme: {
    shopName: window.Shopify?.shop || '${config.projectName}',
    currency: window.Shopify?.currency?.active || 'USD',
    moneyFormat: window.theme?.moneyFormat || '\${{amount}}',
  },
  routes: _bootstrap?.routes ?? {
    cart: '/cart',
    cartAdd: '/cart/add',
    cartChange: '/cart/change',
    cartUpdate: '/cart/update',
    predictiveSearch: '/search/suggest',
  },
  cart: {
    count: _bootstrap?.cart.count ?? 0,
    total: _bootstrap?.cart.total ?? 0,
  },
  events: new EventTarget(),
  version: '1.0.0',
} satisfies StorefrontGlobal;
`;

  await writeFile('frontend/scripts/core/global.ts', _global);
  log('Created: frontend/scripts/core/global.ts', colors.green);

  const _storefront = `import 'vite/modulepreload-polyfill';
import '@/core/global';
import '@/components/sections';
`;

  await writeFile('frontend/entrypoints/storefront.ts', _storefront);
  log('Created: frontend/entrypoints/storefront.ts', colors.green);

  const _styles = `// Sass requires every @use before any other rule, so partials load here.
// 'utils' and 'sections/*' resolve through the loadPaths in vite.config.js.
@use 'utils' as u;
@use 'sections/${config.namespace}-example';

:root {
  --spacing-xs: #{u.spacing('xs')};
  --spacing-sm: #{u.spacing('sm')};
  --spacing-md: #{u.spacing('md')};
  --spacing-lg: #{u.spacing('lg')};
  --spacing-xl: #{u.spacing('xl')};
  --spacing-xxl: #{u.spacing('xxl')};
  --transition-fast: #{u.transition('fast')};
  --transition-base: #{u.transition('base')};
  --transition-slow: #{u.transition('slow')};
  --border-radius: #{u.radius('sm')};
  --border-radius-md: #{u.radius('md')};
  --border-radius-lg: #{u.radius('lg')};
  --border-radius-pill: #{u.radius('pill')};
}

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
`;

  await writeFile('frontend/entrypoints/custom_styling.scss', _styles);
  log('Created: frontend/entrypoints/custom_styling.scss', colors.green);
}

async function createUtilities(config: SetupConfig): Promise<void> {
  header('Creating Utilities');

  const _g = config.projectNameSafe;

  const _utils = `type LogLevel = 'log' | 'info' | 'warn' | 'error';

export function consoleMessage(
  message: string,
  level: LogLevel = 'log',
  data: unknown = null
): void {
  if (!window.${_g}?.settings?.devMode) return;

  const _prefix = '[${config.projectName}]';
  const _styles: Record<LogLevel, string> = {
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

/** The theme editor re-evaluates the bundle, and a second define() throws. */
export function defineElement(tagName: string, elementClass: CustomElementConstructor): void {
  if (customElements.get(tagName)) return;

  customElements.define(tagName, elementClass);
}

export function parseElementConfig<T extends object>(element: HTMLElement, fallback: T): T {
  const _raw = element.dataset.config;
  if (!_raw) return fallback;

  try {
    return { ...fallback, ...(JSON.parse(_raw) as Partial<T>) };
  } catch {
    consoleMessage(\`<\${element.localName}>: invalid data-config JSON\`, 'warn');
    return fallback;
  }
}

/**
 * Defers work until the element nears the viewport. Returns a teardown to call
 * from disconnectedCallback — the observer outlives the element otherwise.
 */
export function whenVisible(
  element: Element,
  callback: () => void,
  rootMargin = '200px'
): () => void {
  if (!('IntersectionObserver' in window)) {
    callback();
    return () => {};
  }

  const _observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;

      _observer.disconnect();
      callback();
    },
    { rootMargin }
  );

  _observer.observe(element);

  return () => _observer.disconnect();
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let _timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    if (_timeout) clearTimeout(_timeout);
    _timeout = setTimeout(() => fn(...args), wait);
  };
}

export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let _lastTime = 0;

  return function executedFunction(...args: Parameters<T>) {
    const _now = Date.now();
    if (_now - _lastTime >= wait) {
      _lastTime = _now;
      fn(...args);
    }
  };
}

export function dispatchStoreEvent(name: string, detail: unknown = {}): void {
  window.${_g}.events.dispatchEvent(new CustomEvent(name, { detail }));

  if (window.${_g}.settings.debugEvents) {
    consoleMessage(\`Event: \${name}\`, 'info', detail);
  }
}

export function subscribeToStoreEvent(
  name: string,
  callback: (event: CustomEvent) => void
): () => void {
  const _handler = (event: Event) => callback(event as CustomEvent);
  window.${_g}.events.addEventListener(name, _handler);

  return () => window.${_g}.events.removeEventListener(name, _handler);
}
`;

  await writeFile('frontend/scripts/utils/index.ts', _utils);
  log('Created: frontend/scripts/utils/index.ts', colors.green);
}

async function createConstants(): Promise<void> {
  const _constants = `export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
} as const;

export const ANIMATION = {
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
} as const;

export const EVENTS = {
  CART_UPDATED: 'cart:updated',
  CART_ADD: 'cart:add',
  VARIANT_CHANGE: 'variant:change',
  MODAL_OPEN: 'modal:open',
  MODAL_CLOSE: 'modal:close',
  DRAWER_OPEN: 'drawer:open',
  DRAWER_CLOSE: 'drawer:close',
} as const;
`;

  await writeFile('frontend/scripts/constants/index.ts', _constants);
  log('Created: frontend/scripts/constants/index.ts', colors.green);
}

async function createSectionBarrel(config: SetupConfig): Promise<void> {
  header('Creating Section Barrel');

  const _barrel = `// Each module calls defineElement() at eval time, so this import is what puts
// the tag on the page.
import './${config.namespace}-example';
`;

  await writeFile('frontend/scripts/components/sections/index.ts', _barrel);
  log('Created: frontend/scripts/components/sections/index.ts', colors.green);
}

async function createExampleSection(config: SetupConfig): Promise<void> {
  header('Creating Example Section');

  const _tag = `${config.namespace}-example`;
  const _class = `${toPascalCase(config.namespace)}Example`;
  const _block = _tag;

  const _configTypes = `// Keys mirror the setting ids in the Liquid schema, so they stay snake_case.
export type ${_class}Config = {
  readonly heading: string;
  readonly button_label: string;
};
`;

  await writeFile(
    `frontend/scripts/components/sections/${_tag}.types.ts`,
    _configTypes
  );
  log(`Created: frontend/scripts/components/sections/${_tag}.types.ts`, colors.green);

  const _component = `import { consoleMessage, defineElement, parseElementConfig } from '@/utils';
import type { ${_class}Config } from './${_tag}.types';

const DEFAULT_CONFIG: ${_class}Config = {
  heading: '',
  button_label: '',
};

export class ${_class} extends HTMLElement {
  private controller: AbortController | null = null;
  private config: ${_class}Config = DEFAULT_CONFIG;
  private body: HTMLElement | null = null;
  private isInitialized = false;

  connectedCallback(): void {
    if (this.isInitialized) return;

    this.body = this.querySelector('.${_block}__body');

    if (!this.body) {
      consoleMessage('${_class}: missing body element', 'warn');
      return;
    }

    this.config = parseElementConfig(this, DEFAULT_CONFIG);
    this.controller = new AbortController();

    this.body.addEventListener('click', this.handleClick, { signal: this.controller.signal });

    this.isInitialized = true;
  }

  disconnectedCallback(): void {
    this.controller?.abort();
    this.controller = null;
    this.body = null;
    this.isInitialized = false;
  }

  private handleClick = (event: Event): void => {
    const _action = (event.target as HTMLElement | null)?.closest('.${_block}__action');
    if (!_action) return;

    this.classList.toggle('is-active');
  };
}

defineElement('${_tag}', ${_class});
`;

  await writeFile(`frontend/scripts/components/sections/${_tag}.ts`, _component);
  log(`Created: frontend/scripts/components/sections/${_tag}.ts`, colors.green);

  const _liquid = `{%- comment -%}
  Reference section. The tag name must match the defineElement() call in
  frontend/scripts/components/sections/${_tag}.ts.
{%- endcomment -%}

<${_tag}
  class="${_block}"
  data-section-id="{{ section.id }}"
  data-config="{{ section.settings | json | escape }}"
>
  {%- if section.settings.heading != blank -%}
    <h2 class="${_block}__heading">{{ section.settings.heading }}</h2>
  {%- endif -%}

  <div class="${_block}__body">
    <button type="button" class="${_block}__action">
      {{- section.settings.button_label -}}
    </button>
  </div>
</${_tag}>

{% schema %}
{
  "name": "Example",
  "tag": "section",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Example section"
    },
    {
      "type": "text",
      "id": "button_label",
      "label": "Button label",
      "default": "Toggle"
    }
  ],
  "presets": [
    {
      "name": "Example"
    }
  ]
}
{% endschema %}
`;

  await mkdir('sections', { recursive: true });
  await writeFile(`sections/${_tag}.liquid`, _liquid);
  log(`Created: sections/${_tag}.liquid`, colors.green);

  const _scss = `@use 'utils' as u;

${_tag} {
  display: block;
  padding: u.spacing('lg') u.spacing('md');
}

.${_block}__heading {
  margin: 0 0 u.spacing('sm');
  font-size: u.fluid(24, 40);
  line-height: 1.2;
}

.${_block}__body {
  display: grid;
  gap: u.spacing('sm');
}

.${_block}__action {
  justify-self: start;
  padding: u.rem(8) u.rem(16);
  border-radius: var(--border-radius);
  font-size: u.rem(14);
  cursor: pointer;
  transition: opacity var(--transition-base);
}

${_tag}.is-active .${_block}__action {
  opacity: 0.6;
}

@include u.min('md') {
  ${_tag} {
    padding: u.spacing('xl') u.spacing('lg');
  }
}

@include u.reduced-motion {
  .${_block}__action {
    transition: none;
  }
}
`;

  await writeFile(`frontend/styles/sections/_${_tag}.scss`, _scss);
  log(`Created: frontend/styles/sections/_${_tag}.scss`, colors.green);
}

// =============================================================================
// CLAUDE FILES
// =============================================================================

async function createClaudeMd(config: SetupConfig): Promise<void> {
  header('Creating CLAUDE.md Files');

  const _g = config.projectNameSafe;
  const _ns = config.namespace;
  const _tag = `${_ns}-carousel`;
  const _class = `${toPascalCase(_ns)}Carousel`;

  const _projectClaudeMd = `# ${config.projectName} — Project Rules

## Project Overview

Shopify theme development project. Every custom section is a custom element —
the tag in the Liquid markup is what boots the behaviour. There is no registry.

- **Styling**: SCSS
- **JavaScript**: TypeScript
- **Package Manager**: yarn
- **Build**: Vite + vite-plugin-shopify

---

## Critical Rules

### Build Commands
- **MUST NOT** run \`yarn build\` unless explicitly requested
- **MUST NOT** run \`shopify theme push\` unless explicitly requested

### Custom Elements
- **MUST** register with \`defineElement()\` from \`@/utils\` at the bottom of the
  component module, then add the module to \`components/sections/index.ts\`
- **MUST** implement \`connectedCallback()\` and \`disconnectedCallback()\`
- **MUST** release everything in \`disconnectedCallback()\`: listeners, observers,
  timers, subscriptions. One \`AbortController\` passed as
  \`addEventListener(..., { signal })\` removes them all at once and cannot drift
  out of sync with the bind site.
- **MUST** store handlers as arrow-function class fields — \`.bind(this)\` at the
  call site creates a reference that can never be removed.
- **MUST** guard against double init with an \`isInitialized\` flag.
- **MUST NOT** add \`data-section-type\` or any registry lookup — the tag is the type.

### Naming
- Function-scoped variables: \`_prefixed\` (\`_element\`, \`_config\`)
- Class members: unprefixed (\`private container\`, not \`private _container\`)
- Types and classes: \`PascalCase\`. Constants: \`UPPER_SNAKE_CASE\`
- Functions: \`camelCase\` with an action verb (\`fetchCart\`, \`handleClick\`)

### Early Returns
- **MUST** use guard clauses at the start of functions
- **MUST NOT** nest conditions more than 2 levels deep

### Logging
- **MUST** use \`consoleMessage()\`, never \`console.log\` directly
- Logging respects \`window.${_g}.settings.devMode\`
- **Error-level logs must never be gated behind the debug flag.** A swallowed
  initialisation error is exactly the one you need to see.

### State Classes
- Use \`.is-active\`, \`.is-loading\`, \`.is-hidden\`, \`.is-open\`
- Never use \`.active\`, \`.loading\`, \`.hidden\` (too generic)

---

## File Locations

| Type | Location |
|------|----------|
| Section components | \`frontend/scripts/components/sections/${_ns}-*.ts\` |
| Section types | \`frontend/scripts/components/sections/${_ns}-*.types.ts\` |
| Section barrel | \`frontend/scripts/components/sections/index.ts\` |
| Shared components | \`frontend/scripts/components/shared/\` |
| Global bootstrap | \`frontend/scripts/core/global.ts\` |
| Utilities | \`frontend/scripts/utils/\` |
| Constants | \`frontend/scripts/constants/\` |
| Shared types | \`frontend/scripts/types/\` |
| SCSS helpers and tokens | \`frontend/styles/utils/\` |
| Section styles | \`frontend/styles/sections/\` |
| Component styles | \`frontend/styles/components/\` |

One section = one Liquid file + one TypeScript file + one \`.types.ts\` companion
+ one SCSS partial, all sharing the \`${_ns}-<name>\` stem.

---

## Global Object

Access via \`window.${_g}\`:

\`\`\`typescript
window.${_g}.settings.devMode  // boolean — driven by a theme setting
window.${_g}.theme.currency    // string
window.${_g}.routes.cartAdd    // string — Liquid routes, never hardcode /cart/add
window.${_g}.cart.count        // number — seeded from Liquid at first paint
window.${_g}.events            // EventTarget
\`\`\`

Values come from \`snippets/${_ns}-theme-settings.liquid\`, which renders before
the bundle. Anything Liquid knows and JavaScript needs belongs in that snippet.

---

## Events

\`\`\`typescript
import { dispatchStoreEvent, subscribeToStoreEvent } from '@/utils';

dispatchStoreEvent('cart:updated', { count: 5 });

const unsubscribe = subscribeToStoreEvent('cart:updated', (event) => {
  consoleMessage('cart', 'info', event.detail.count);
});
\`\`\`

---

## The namespace rule

Every custom Liquid file carries the \`${_ns}-\` prefix:

| Kind | Path |
|------|------|
| Sections | \`sections/${_ns}-*.liquid\` |
| Snippets | \`snippets/${_ns}-*.liquid\` |
| Blocks | \`blocks/${_ns}-*.liquid\` |

A base-theme upgrade is then: overwrite every file without the prefix, and
whatever survives is ours. The prefix also gives every custom element tag the
hyphen the spec requires.

**Core theme files get additive edits only, and each one is a debt.** Record
them in a table here. Before editing any other core file, try a theme setting, a
section, a block, or a metafield first — those survive an upgrade untouched.

### Baselines

- Base theme: **TODO — record name and version**
- \`shopify theme check\`: **TODO — record the offence count on day one.**
  Pre-existing offences are not yours to fix; compare against that number rather
  than aiming for zero.

---

## Performance

The entry bundle does one thing: define tags. Nothing queries the DOM, fetches,
or runs until an element is on the page. Protect that budget.

- Heavy work goes behind \`await import('@/components/shared/…')\` inside
  \`connectedCallback()\` — Vite splits the chunk, and only pages carrying the tag
  pay for it.
- Below-the-fold work goes behind \`whenVisible(this, fn)\`. Call the teardown it
  returns from \`disconnectedCallback()\`.
- Cache element references once on init. Never \`querySelector\` inside a handler
  — delegate from the section root and use \`closest()\`.
- Images come from Shopify's CDN with \`loading="lazy"\`, never a JS lazy-loader.

---

## Things that fail review

- \`console.*\` anywhere outside the logging utility
- Magic numbers in components — put them in \`frontend/scripts/constants/\`
- Utility class names in Liquid (\`.flex\`, \`.mt-4\`) — semantic names only
- A listener added in \`connectedCallback()\` with no matching teardown
- \`querySelector\` called repeatedly in a handler instead of cached on init
- Desktop-first CSS. Mobile is the base; \`@media (min-width: ...)\` adds
- Animating \`width\`/\`height\`/\`top\`/\`left\` — use \`transform\` and \`opacity\`, and
  honour \`@media (prefers-reduced-motion: reduce)\`

---

## Before committing

\`yarn type-check && yarn lint && yarn build\`, then confirm \`shopify theme check\`
still matches the recorded baseline.

---

## Quick Commands

\`\`\`bash
yarn dev          # Start development
yarn build        # Build assets
yarn type-check   # tsc --noEmit
yarn lint         # eslint frontend
yarn deploy       # Build, then push — writes to the configured theme
\`\`\`
`;

  await writeFile('.claude/CLAUDE.md', _projectClaudeMd);
  log('Created: .claude/CLAUDE.md', colors.green);

  const _frontendClaudeMd = `# Frontend Development Guide

## The tag is the initiator

Every custom section is a custom element. There is no registry, no boot loop, no
\`querySelectorAll\` pass. The tag appears in the DOM, the browser upgrades it,
\`connectedCallback()\` runs.

That gives three things for free:

- **Theme editor.** A setting change re-renders the section HTML, so the old
  element is destroyed and a new one is constructed. \`shopify:section:load\` and
  \`shopify:section:unload\` need no handling at all.
- **Section Rendering API.** Markup fetched over AJAX boots on insert.
- **Ordering.** No dependency on \`DOMContentLoaded\`.

### One section = four files

| File | Purpose |
|------|---------|
| \`sections/${_tag}.liquid\` | Markup, \`<${_tag}>\` as the root |
| \`frontend/scripts/components/sections/${_tag}.ts\` | Behaviour + \`defineElement()\` |
| \`frontend/scripts/components/sections/${_tag}.types.ts\` | Config and any local types |
| \`frontend/styles/sections/_${_tag}.scss\` | Styles |

Tag names need a hyphen — the \`${_ns}-\` prefix satisfies that and matches the
file namespace rule. Tag, Liquid filename, and TypeScript filename share one name.

### Component

\`\`\`typescript
import { consoleMessage, defineElement, parseElementConfig } from '@/utils';
import type { ${_class}Config } from './${_tag}.types';

const DEFAULT_CONFIG: ${_class}Config = {
  autoplay: false,
  interval: 5000,
};

export class ${_class} extends HTMLElement {
  private controller: AbortController | null = null;
  private config: ${_class}Config = DEFAULT_CONFIG;
  private track: HTMLElement | null = null;
  private isInitialized = false;

  connectedCallback(): void {
    if (this.isInitialized) return;

    this.track = this.querySelector('.${_tag}__track');

    if (!this.track) {
      consoleMessage('${_class}: missing track', 'warn');
      return;
    }

    this.config = parseElementConfig(this, DEFAULT_CONFIG);
    this.controller = new AbortController();

    this.track.addEventListener('click', this.handleClick, { signal: this.controller.signal });

    this.isInitialized = true;
  }

  disconnectedCallback(): void {
    this.controller?.abort();
    this.controller = null;
    this.track = null;
    this.isInitialized = false;
  }

  private handleClick = (event: Event): void => {
    const _slide = (event.target as HTMLElement | null)?.closest('.${_tag}__slide');
    if (!_slide) return;
  };
}

defineElement('${_tag}', ${_class});
\`\`\`

Then add one line to \`frontend/scripts/components/sections/index.ts\`:

\`\`\`typescript
import './${_tag}';
\`\`\`

That barrel is imported by \`frontend/entrypoints/storefront.ts\`. Forgetting it is
the only way a section fails to mount.

### Types

Config and any section-local types live in the \`.types.ts\` companion, never in
the component file:

\`\`\`typescript
// Keys mirror the setting ids in the Liquid schema, so they stay snake_case.
export type ${_class}Config = {
  readonly autoplay: boolean;
  readonly interval: number;
};
\`\`\`

Cross-section types (\`StorefrontGlobal\`, \`ShopifyBlockEvent\`, …) live in
\`frontend/scripts/types/index.ts\`.

### Liquid

\`\`\`liquid
<${_tag}
  class="${_tag}"
  data-section-id="{{ section.id }}"
  data-config="{{ section.settings | json | escape }}"
>
  <div class="${_tag}__track">
    {%- for block in section.blocks -%}
      <div class="${_tag}__slide" {{ block.shopify_attributes }}>…</div>
    {%- endfor -%}
  </div>
</${_tag}>
\`\`\`

\`data-config\` carries the whole settings object; \`parseElementConfig()\` merges it
over the defaults and warns on malformed JSON. \`data-section-id\` stays for the
Section Rendering API. There is no \`data-section-type\` — the tag is the type.

---

## Theme editor

Load and unload are handled by the element lifecycle. The block events are the
exception: they fire without re-rendering anything, so the element listens for
them itself. They bubble from the block up through the section root.

\`\`\`typescript
this.addEventListener('shopify:block:select', this.handleBlockSelect, {
  signal: this.controller.signal,
});
\`\`\`

| Event | Handled by |
|-------|------------|
| \`shopify:section:load\` | \`connectedCallback()\` — automatic |
| \`shopify:section:unload\` | \`disconnectedCallback()\` — automatic |
| \`shopify:section:select\` / \`:deselect\` | Listen on \`this\` if needed |
| \`shopify:block:select\` / \`:deselect\` | Listen on \`this\` |

---

## Rules that bite

- **\`disconnectedCallback()\` also fires on a DOM move**, not just removal. Reset
  state so a reconnect re-initialises cleanly — that is what \`isInitialized = false\`
  is for.
- **Custom elements are \`display: inline\` by default.** Every section root needs
  an explicit \`display\` in its SCSS partial.
- **\`defineElement()\` guards the define call.** The theme editor re-evaluates the
  bundle, and a duplicate \`customElements.define()\` throws.
- **Handlers are arrow-function class fields.** \`.bind(this)\` at the call site
  creates a new reference that can never be removed.
- **Don't make every div an element.** Tags are for things with their own
  lifecycle or state; inner markup stays classes and \`data-*\`.

---

## Keeping the bundle small

The entry bundle does one thing: define tags. Nothing queries the DOM, nothing
fetches, nothing runs until an element is actually on the page.

**Heavy work goes behind a dynamic import**, which is also the code-splitting
boundary — the chunk is fetched only by pages that contain the tag:

\`\`\`typescript
private async loadGallery(): Promise<void> {
  try {
    const { createGallery } = await import('@/components/shared/gallery');
    createGallery(this, { signal: this.controller!.signal });
  } catch {
    consoleMessage('${_class}: chunk failed to load', 'error');
  }
}
\`\`\`

**Below-the-fold sections wait for the viewport.** \`whenVisible()\` returns a
teardown, because an observer left running outlives the element:

\`\`\`typescript
connectedCallback(): void {
  this.controller = new AbortController();
  this.stopObserving = whenVisible(this, () => this.startAutoplay());
}

disconnectedCallback(): void {
  this.stopObserving?.();
  this.controller?.abort();
}
\`\`\`

**Rules of thumb**

- Cache element references once in \`connectedCallback()\`. Never \`querySelector\`
  inside a handler — delegate from the section root and use \`closest()\`.
- One \`AbortController\` per element beats one listener per child node.
- Anything that measures layout (\`getBoundingClientRect\`, \`offsetWidth\`) belongs
  in a \`requestAnimationFrame\`, and never in a scroll or resize handler without
  \`throttle()\`.
- Images come from Shopify's CDN with \`loading="lazy"\` — never a JS lazy-loader.
- \`vite/modulepreload-polyfill\` stays in the entrypoint. It is inert today, and
  it is what makes the dynamic-import pattern above work on older Safari.

---

## Styling (SCSS)

Every partial opens with the helpers. \`utils\` resolves through the \`loadPaths\`
entry in \`vite.config.js\`, so the path never changes with nesting:

\`\`\`scss
@use 'utils' as u;
\`\`\`

| Helper | Use |
|--------|-----|
| \`u.rem(16)\` | px to rem. Takes a list too: \`u.rem(16 24)\` -> \`1rem 1.5rem\`. |
| \`u.rem-calc(16)\` | Alias of \`u.rem()\`, for parity with our other themes. |
| \`u.fluid(24, 40)\` | Scales linearly between the 390px and 1728px viewports, clamped at both ends. A \`(min, mid, max)\` list also works; the middle value is ignored. |
| \`u.spacing('lg')\` | Spacing token. \`xs\`–\`md\` are fixed rem, \`lg\`–\`xxl\` are fluid. |
| \`u.transition('base')\`, \`u.radius('md')\`, \`u.color('text')\` | The other token scales. |
| \`@include u.min('md')\` | Mobile-first breakpoint. Also \`u.max()\`, \`u.between()\`. |
| \`@include u.reduced-motion\` | \`prefers-reduced-motion: reduce\` block. |

\`u.fluid(24, 40)\` compiles to \`clamp(1.5rem, 1.20852rem + 1.19581vw, 2.5rem)\` —
24px on a 390px phone, 40px at 1728px, linear between, and it stops growing
outside that range. That is the whole point: one declaration instead of a value
plus two breakpoint overrides.

\`\`\`scss
@use 'utils' as u;

${_tag} {
  display: block;
  padding: u.spacing('lg') u.spacing('md');
}

.${_tag}__heading {
  font-size: u.fluid(24, 40);
  margin-bottom: u.rem(8);
}

@include u.min('md') {
  ${_tag} {
    padding: u.spacing('xl') u.spacing('lg');
  }
}
\`\`\`

Rules:

- **MUST NOT** write raw \`px\`. \`u.rem()\` for fixed sizes, \`u.fluid()\` for anything
  that should scale — type, section padding, large gaps. Hairline borders aside.
- **MUST** reach values through the token functions. A value two sections share
  belongs in \`frontend/styles/utils/_tokens.scss\`.
- **MUST** stay mobile-first: base styles are the phone, \`@include u.min()\` adds.
- The \`:root\` block in the entrypoint mirrors the tokens as custom properties, so
  Liquid and one-off styles can use \`var(--spacing-lg)\`.

BEM and state classes as usual:

\`\`\`scss
.${_tag}__track { }
.${_tag}__slide { }
.${_tag}--boxed { }
${_tag}.is-loading { }
\`\`\`

---

## Pre-flight

- [ ] \`connectedCallback()\` and \`disconnectedCallback()\` both present
- [ ] Everything allocated is released via the \`AbortController\` or in \`disconnectedCallback()\`
- [ ] \`defineElement()\` called at the bottom of the module
- [ ] Module imported in \`components/sections/index.ts\`
- [ ] Config type in the \`.types.ts\` companion
- [ ] Guard clauses for early returns; function-scoped vars \`_prefixed\`
- [ ] Logging via \`consoleMessage()\`
- [ ] Root has an explicit \`display\`; styles are mobile-first
- [ ] Sizes go through \`u.rem()\` / \`u.fluid()\`, not raw \`px\`
- [ ] Tested in the theme editor, including block select
`;

  await writeFile('frontend/CLAUDE.md', _frontendClaudeMd);
  log('Created: frontend/CLAUDE.md', colors.green);
}

async function createAgents(config: SetupConfig): Promise<void> {
  header('Creating Claude Agents');

  const _ns = config.namespace;
  const _tag = `${_ns}-carousel`;
  const _class = `${toPascalCase(_ns)}Carousel`;

  // ui-design agent
  const _uiDesignAgent = `# UI Design Agent

You are a UI/UX design specialist for Shopify theme development.

## Expertise

- SCSS with design tokens and mixins
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

## SCSS Patterns

\`\`\`scss
@use 'utils' as u;

.component {
  padding: u.spacing('md');
  color: u.color('text');
  font-size: u.fluid(16, 20);
  transition: opacity u.transition('base');

  @include u.min('md') {
    padding: u.spacing('lg');
  }
}
\`\`\`

## Reduced Motion

\`\`\`scss
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

You are a TypeScript specialist for Shopify theme development.

## Expertise

- Custom elements as section initiators
- Shopify theme editor integration
- Event-driven architecture
- Keeping the entry bundle small

## Key Rules

### The tag is the initiator

A section is a custom element. There is no registry and no \`data-section-type\` —
the tag boots the behaviour, and the theme editor's re-render gives you load and
unload for free.

\`\`\`typescript
import { consoleMessage, defineElement, parseElementConfig } from '@/utils';
import type { ${_class}Config } from './${_tag}.types';

const DEFAULT_CONFIG: ${_class}Config = { autoplay: false };

export class ${_class} extends HTMLElement {
  private controller: AbortController | null = null;
  private config: ${_class}Config = DEFAULT_CONFIG;
  private track: HTMLElement | null = null;
  private isInitialized = false;

  connectedCallback(): void {
    if (this.isInitialized) return;

    this.track = this.querySelector('.${_tag}__track');

    if (!this.track) {
      consoleMessage('${_class}: missing track', 'warn');
      return;
    }

    this.config = parseElementConfig(this, DEFAULT_CONFIG);
    this.controller = new AbortController();

    this.track.addEventListener('click', this.handleClick, { signal: this.controller.signal });

    this.isInitialized = true;
  }

  disconnectedCallback(): void {
    this.controller?.abort();
    this.controller = null;
    this.track = null;
    this.isInitialized = false;
  }

  private handleClick = (event: Event): void => {
    const _slide = (event.target as HTMLElement | null)?.closest('.${_tag}__slide');
    if (!_slide) return;
  };
}

defineElement('${_tag}', ${_class});
\`\`\`

Then add \`import './${_tag}';\` to \`frontend/scripts/components/sections/index.ts\`.
That barrel import is the only thing that registers a section.

### Non-negotiables

- One \`AbortController\` per element, aborted in \`disconnectedCallback()\`
- Handlers are arrow-function class fields — \`.bind(this)\` never detaches
- \`isInitialized\` guard, reset on disconnect (it also fires on a DOM move)
- Config type lives in the \`.types.ts\` companion, never in the component file
- Guard clauses first; never nest more than two levels
- Function-scoped variables \`_prefixed\`; class members unprefixed

### Performance

- Heavy dependencies go behind \`await import(...)\` inside \`connectedCallback()\`
- Below-the-fold work goes behind \`whenVisible(this, fn)\`; call its teardown on
  disconnect
- Cache element references on init — never \`querySelector\` inside a handler.
  Delegate from the root and use \`closest()\`

### Logging

- ALWAYS use \`consoleMessage()\` from \`@/utils\`; NEVER \`console.log\`
- Error-level logs are never gated behind the debug flag

### Events

- Dispatch: \`dispatchStoreEvent('cart:updated', { count: 5 })\`
- Subscribe: \`subscribeToStoreEvent('cart:updated', handler)\` — keep the
  returned unsubscribe and call it on disconnect
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
{% comment %} sections/${_ns}-my-section.liquid {% endcomment %}

<${_ns}-my-section
  class="${_ns}-my-section"
  data-section-id="{{ section.id }}"
  data-config="{{ section.settings | json | escape }}"
>
  {% for block in section.blocks %}
    {%- case block.type -%}
      {%- when 'item' -%}
        <div class="${_ns}-my-section__item" {{ block.shopify_attributes }}>
          {{ block.settings.title }}
        </div>
    {%- endcase -%}
  {% endfor %}
</${_ns}-my-section>

{% schema %}
{
  "name": "My Section",
  "tag": "section",
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
- The custom element tag IS the section wrapper and the only initiator — there is
  no registry and no \`data-section-type\`
- Tag name matches the Liquid filename: \`sections/${_ns}-foo.liquid\` → \`<${_ns}-foo>\`
- Include \`data-section-id\` for the Section Rendering API
- Pass the whole settings object via \`data-config="{{ section.settings | json | escape }}"\`
- Add \`{{ block.shopify_attributes }}\` to blocks for the theme editor

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
\`\`\`typescript
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
\`\`\`scss
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

  header(config.themeSource === 'existing' ? 'Pulling Live Theme' : 'Pulling Base Theme');

  try {
    await $`shopify theme pull --theme ${config.themeId} --environment ${config.environmentName}`;
    log('Theme pulled successfully', colors.green);

    if (config.themeSource === 'existing') {
      // The baseline must be byte-identical to what is live, so every later diff
      // is unambiguously ours.
      log('\nCommit this BEFORE adding anything else:', colors.yellow);
      log('  git add -A', colors.dim);
      log('  git commit -m "chore(theme): pull live theme as baseline"', colors.dim);
      log('\nThen record the theme-check baseline:', colors.yellow);
      log('  shopify theme check', colors.dim);
      log('Pre-existing offences in core files are not yours to fix.', colors.dim);
    }

    const _scanResult = await scanThemeForEvents('.');
    displayThemeScanResults(_scanResult);
  } catch (_error) {
    log('Error pulling theme', colors.red);
    console.error(_error);
  }
}

async function runInitialBuild(): Promise<void> {
  header('Running Initial Build');

  try {
    log('Building assets...', colors.cyan);

    await $`yarn build`;

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
  log('   yarn dev', colors.yellow);
  console.log();

  log('2. Build assets:', colors.cyan);
  log('   yarn build', colors.yellow);
  console.log();

  log('3. Deploy to Shopify:', colors.cyan);
  log('   yarn deploy', colors.yellow);
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
    // --config <file> bypasses the prompts entirely, so the script can be driven
    // by CI or a coding agent. readline drops piped stdin under Bun, so feeding
    // answers on stdin does not work.
    const _configFlag = process.argv.indexOf('--config');
    const _config =
      _configFlag !== -1 && process.argv[_configFlag + 1]
        ? await loadConfigFile(process.argv[_configFlag + 1])
        : await askQuestions();

    subheader('Configuration Summary');
    log(`Project:      ${_config.projectName}`, colors.cyan);
    log(`Namespace:    ${_config.namespace}-*`, colors.cyan);
    log(`Starting from: ${_config.themeSource === 'existing' ? 'existing live theme' : 'new build'}`, colors.cyan);
    log(`GitHub sync:  ${_config.githubIntegration ? 'yes (settings_data.json tracked)' : 'no (CLI only)'}`, colors.cyan);
    log(`Store:        ${_config.storeUrl || '(not configured)'}`, colors.cyan);
    log(`Theme:        ${_config.themeId || '(not selected)'}`, colors.cyan);
    console.log();

    if (_configFlag === -1) {
      const _confirm = await prompt('Proceed with setup? (y/n):');
      if (!['y', 'yes'].includes(_confirm.toLowerCase())) {
        log('Setup cancelled.', colors.yellow);
        process.exit(0);
      }
    }

    // The theme is pulled FIRST when starting from an existing store, so the
    // baseline commit can be the merchant's theme untouched.
    if (_config.themeSource === 'existing') {
      await pullTheme(_config);
    }

    await createPackageJson(_config);
    await createYarnRc();
    await installDependencies();
    await createDirectoryStructure(_config);
    await createViteConfig(_config);
    await createPostCSSConfig();
    await createTypeScriptConfig();
    await createShopifyThemeToml(_config);
    await createGitIgnore(_config);
    await createShopifyIgnore();
    await createGitHubWorkflow(_config);
    await createEslintConfig();
    await createStyleHelpers();
    await createEntrypoints(_config);
    await createUtilities(_config);
    await createConstants();
    await createSectionBarrel(_config);
    await createExampleSection(_config);
    await createClaudeMd(_config);
    await createAgents(_config);

    if (_config.themeSource === 'new') {
      await pullTheme(_config);
    }

    await runInitialBuild();

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
