// Bare imports, not re-exports: assigning window.__NS__ is the point, and the
// entrypoint loads core before any module that reads it at mount time. `cart`
// follows `globals` because its request handler writes window.__NS__.cart.
import './globals';
import './cart';

export * from './element';
