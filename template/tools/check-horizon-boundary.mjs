// Guards the line between __NS_TITLE__ and Horizon.
//
// Liquid Ajax Cart owns every write to the cart, and the way that breaks is
// quiet: a form that lost its wrapper posts a full page navigation instead of
// opening the drawer, and a Horizon cart script that comes back binds the same
// submit a second time. Neither shows up in type-check, lint or theme check.
//
// A Horizon upgrade overwrites every unprefixed file, so this runs in CI to
// catch what the upgrade silently undid.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const THEME_DIRS = ['sections', 'snippets', 'blocks', 'layout'];
const FRONTEND_DIR = 'frontend';

const WRAPPER_OPEN = '<ajax-cart-product-form>';
const WRAPPER_CLOSE = '</ajax-cart-product-form>';

// Horizon scripts that bind the cart. Loading any of them alongside Liquid Ajax
// Cart puts two handlers on one submit, which is a double add.
const FORBIDDEN_SCRIPTS = [
  'product-form.js',
  'sticky-add-to-cart.js',
  'fly-to-cart.js',
  'standard-actions-override.js',
  'cart-drawer.js',
  'quick-order-list.js',
];

// A product form that never posts to the cart. `blocks/price.liquid` renders
// Shop Pay instalment terms through {% form 'product' %} and has no submit, so
// wrapping it would hand Liquid Ajax Cart a form nothing ever sends.
const UNWRAPPED_FORMS_ALLOWED = new Set(['blocks/price.liquid']);

const failures = [];

function fail(file, message, fix) {
  failures.push({ file, message, fix });
}

function walk(dir) {
  const _entries = [];

  for (const _name of readdirSync(dir)) {
    const _full = path.join(dir, _name);

    if (statSync(_full).isDirectory()) {
      _entries.push(...walk(_full));
      continue;
    }

    _entries.push(_full);
  }

  return _entries;
}

// Comments are stripped before anything is matched. Every rule below explains
// itself in a comment beside the markup it governs, and a rule that trips on its
// own explanation is a rule nobody will keep writing.
function stripComments(source) {
  return source
    .replace(/{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/g, '')
    .replace(/{%-?\s*doc\s*-?%}[\s\S]*?{%-?\s*enddoc\s*-?%}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function read(file) {
  return { file, source: stripComments(readFileSync(file, 'utf8')) };
}

const themeFiles = THEME_DIRS.flatMap((_dir) => walk(_dir))
  .filter((_file) => _file.endsWith('.liquid'))
  .map(read);

const frontendFiles = walk(FRONTEND_DIR)
  .filter((_file) => /\.(ts|js|scss)$/.test(_file))
  .map(read);

// 1. Every product form that can add to the cart sits inside the wrapper.
//
// Nearest-opener wins: walk back from the form tag and check the closest
// wrapper boundary is an opening one. A form after a closed wrapper is outside
// it, which is exactly the case a naive "does the file contain the tag" check
// would miss.
for (const { file, source } of themeFiles) {
  const _forms = [...source.matchAll(/{%-?\s*form\s+'product'/g)];
  if (_forms.length === 0) continue;

  for (const _form of _forms) {
    const _before = source.slice(0, _form.index);
    const _opened = _before.lastIndexOf(WRAPPER_OPEN);
    const _closed = _before.lastIndexOf(WRAPPER_CLOSE);
    const _wrapped = _opened !== -1 && _opened > _closed;

    if (_wrapped === UNWRAPPED_FORMS_ALLOWED.has(file)) {
      fail(
        file,
        _wrapped
          ? `a {% form 'product' %} is wrapped in ${WRAPPER_OPEN} but this file is on the allowlist`
          : `a {% form 'product' %} is not inside ${WRAPPER_OPEN}`,
        _wrapped
          ? `Remove ${file} from UNWRAPPED_FORMS_ALLOWED, or unwrap the form.`
          : `Wrap it, or add ${file} to UNWRAPPED_FORMS_ALLOWED with the reason it never posts.`
      );
    }
  }
}

// 2. One form per wrapper, each with somewhere to put an error.
//
// Liquid Ajax Cart refuses a wrapper holding anything but exactly one form, and
// reports line-level failures into [data-ajax-cart-errors="form"] inside it —
// without that target a rejected add is silent.
for (const { file, source } of themeFiles) {
  const _opens = [...source.matchAll(new RegExp(WRAPPER_OPEN, 'g'))];

  for (const _open of _opens) {
    const _end = source.indexOf(WRAPPER_CLOSE, _open.index);

    if (_end === -1) {
      fail(file, `${WRAPPER_OPEN} is never closed`, `Add ${WRAPPER_CLOSE}.`);
      continue;
    }

    const _region = source.slice(_open.index, _end);
    const _forms = _region.match(/{%-?\s*form\s+'product'|<form\b/g)?.length ?? 0;

    if (_forms !== 1) {
      fail(
        file,
        `${WRAPPER_OPEN} holds ${_forms} forms`,
        'Liquid Ajax Cart requires exactly one. Split the wrapper.'
      );
    }

    if (!_region.includes('data-ajax-cart-errors="form"')) {
      fail(
        file,
        `${WRAPPER_OPEN} has no [data-ajax-cart-errors="form"] target`,
        'Add one inside the wrapper, or a rejected add fails silently.'
      );
    }
  }
}

// 3. Horizon's cart scripts stay off the page.
for (const { file, source } of themeFiles) {
  for (const _script of FORBIDDEN_SCRIPTS) {
    if (!source.includes(`'${_script}'`)) continue;

    fail(
      file,
      `loads Horizon's ${_script}`,
      'Liquid Ajax Cart owns the cart. Two handlers on one submit is a double add.'
    );
  }
}

// 4. Nothing in the theme answers to Horizon's `cart-drawer` id.
//
// snippets/theme-drawer.liquid reopens saved drawers by id straight out of
// sessionStorage, setting `open` as a plain attribute — which would show the
// __NS_TITLE__ drawer with no backdrop and no focus trap.
for (const { file, source } of themeFiles) {
  if (source.includes('id="cart-drawer"')) {
    fail(file, 'gives an element Horizon\'s "cart-drawer" id', 'Use "__NS__-cart-drawer" — see CART.DRAWER_ID.');
  }

  // Only in files we own. Horizon's own header still points at the id its
  // drawer used to carry; that markup does not render, and rewriting a core
  // file to fix a button nobody sees would cost more than it saves.
  if (!path.basename(file).startsWith('__NS__-')) continue;

  if (/aria-controls="cart-drawer"|#cart-drawer\//.test(source)) {
    fail(file, 'points a control at Horizon\'s "cart-drawer" id', 'Point it at "__NS__-cart-drawer".');
  }
}

// 5. The bundle never reaches into Horizon.
for (const { file, source } of frontendFiles) {
  if (/from\s+['"]@theme\//.test(source)) {
    fail(file, 'imports a Horizon module (@theme/…)', 'Horizon assets are replaced by upgrades. Own the behaviour in frontend/.');
  }

  if (/\bwindow\.Theme\b/.test(source)) {
    fail(file, "reads Horizon's window.Theme", 'Read window.__NS__ instead, seeded by snippets/__NS__-theme-settings.liquid.');
  }
}

if (failures.length === 0) {
  console.log(`Horizon boundary intact — ${themeFiles.length} Liquid and ${frontendFiles.length} frontend files checked.`);
  process.exit(0);
}

console.error(`Horizon boundary broken in ${failures.length} place(s):\n`);

for (const _failure of failures) {
  console.error(`  ${_failure.file}`);
  console.error(`    ${_failure.message}`);
  console.error(`    → ${_failure.fix}\n`);
}

process.exit(1);
