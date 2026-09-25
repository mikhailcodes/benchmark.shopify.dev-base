export const BREAKPOINTS: Readonly<Record<string, number>> = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
} as const;

export const EVENTS: Readonly<Record<string, string>> = {
  CART_UPDATED: 'cart:updated',
  CART_ADD: 'cart:add',
  VARIANT_CHANGE: 'variant:change',
  MODAL_OPEN: 'modal:open',
  MODAL_CLOSE: 'modal:close',
  DRAWER_OPEN: 'drawer:open',
  DRAWER_CLOSE: 'drawer:close',
} as const;

export const REVEAL = {
  // Fires a little before the block reaches the fold, so the motion reads as
  // part of the scroll rather than a reaction to it.
  ROOT_MARGIN: '0px 0px -12% 0px',
  // A share of the element, not of the viewport: a section taller than the
  // screen can never show a large fraction of itself, and would never fire.
  AMOUNT: 0.05,
  // Hard stop. If the observer has not fired by now the content shows anyway.
  FALLBACK: 2500,
  DURATION: 0.7,
  EASE: [0.16, 1, 0.3, 1],
  BLOCK_STAGGER: 0.09,
  WORD_STAGGER: 0.045,
  BLOCK_OFFSET: '1rem',
} as const;

export const MEDIA = {
  ROOT_MARGIN: '200px',
} as const;

export const CART = {
  // Deliberately outside Horizon's `cart-drawer` id: its theme-drawer restore
  // script reopens saved drawers by id and would force this dialog open without
  // showModal(), losing the backdrop and the focus trap.
  DRAWER_ID: '__NS__-cart-drawer',
  // Any control pointing at the drawer opens it — the element claims the click
  // rather than the markup naming a __NS_TITLE__-specific hook.
  TRIGGER_SELECTOR: '[aria-controls="__NS__-cart-drawer"]',
  // Shopify answers 200 for a discount code it rejects, so the verdict is read
  // back off the pills Liquid re-rendered. One frame is not enough — the swap
  // happens on the same event this waits behind.
  DISCOUNT_VERDICT_DELAY: 50,
} as const;
