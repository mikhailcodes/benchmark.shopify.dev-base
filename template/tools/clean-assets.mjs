import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const ASSETS_DIR = path.resolve('assets');
const ENTRYPOINTS_DIR = path.resolve('frontend/entrypoints');

rmSync(path.resolve('dist'), { recursive: true, force: true });
rmSync(path.join(ASSETS_DIR, '.vite'), { recursive: true, force: true });

if (!existsSync(ASSETS_DIR) || !existsSync(ENTRYPOINTS_DIR)) process.exit(0);

// Only files Vite emitted for an entrypoint are removed: <entry>-<hash>.<ext>.
// The theme's own assets have no hash segment, so they are left alone.
const _emitted = readdirSync(ENTRYPOINTS_DIR).map(
  (_file) => new RegExp(`^${path.parse(_file).name}-[A-Za-z0-9_-]{6,}\\.(js|css)(\\.map)?$`)
);

for (const _file of readdirSync(ASSETS_DIR)) {
  if (_emitted.some((_pattern) => _pattern.test(_file))) {
    rmSync(path.join(ASSETS_DIR, _file), { force: true });
  }
}
