// Liquid Ajax Cart owns every write to the cart: adds from a product form,
// quantity changes in the drawer, the order note and the discount code. It
// queues requests rather than racing them, re-renders every
// [data-ajax-cart-section] from Liquid after each one, and surfaces line-level
// errors into [data-ajax-cart-errors].
//
// It replaces Horizon's cart JavaScript rather than sitting beside it. Two
// libraries intercepting the same submit is a double add, so snippets/scripts
// .liquid no longer loads product-form, sticky-add-to-cart, fly-to-cart,
// cart-discount or the standard-actions override.
//
// Imported for its side effects only — it registers <ajax-cart-product-form>
// and <ajax-cart-quantity>, and reads the document on init.
import 'liquid-ajax-cart';

import { consoleMessage, dispatchStoreEvent } from '@/utils';
import { EVENTS } from '@/constants';
import type { CartPayload, LiquidAjaxCartRequestEndEvent } from '@/types/cart.types';

// The value behind StandardEvents.cartLinesUpdate, which arrives from the
// Shopify CDN rather than the bundle. Horizon's cart-icon listens for it.
const CART_LINES_UPDATE = 'shopify:cart:lines-update';

/**
 * Shopify's standard cart event, in the shape its consumers actually read.
 *
 * Horizon's cart-icon does `event.promise?.then(({ cart, detail }) => …)`, and
 * the optional chaining means a plain CustomEvent is not an error — it is a
 * silent no-op that leaves the badge stale. The promise is already resolved; it
 * exists because that is the contract, not because anything is pending.
 */
function buildLinesUpdateEvent(itemCount: number): CustomEvent {
  const _event = new CustomEvent(CART_LINES_UPDATE, {
    bubbles: true,
    detail: { itemCount, source: 'liquid-ajax-cart' },
  });

  Object.defineProperty(_event, 'promise', {
    value: Promise.resolve({
      cart: { totalQuantity: itemCount },
      detail: { itemCount },
    }),
  });

  return _event;
}

document.addEventListener('liquid-ajax-cart:request-end', (event: Event) => {
  const _state = (event as LiquidAjaxCartRequestEndEvent).detail?.requestState;

  if (!_state?.responseData?.ok) {
    consoleMessage(`Cart: ${_state?.requestType ?? 'request'} failed`, 'warn');
    return;
  }

  // detail.cart, never responseData.body: /cart/add.js answers with the lines
  // it just added, not the cart, so body.item_count is undefined on the one
  // request that changes the count most often. Liquid Ajax Cart fires a second
  // request for the whole cart and hangs it on detail.
  const _cart: CartPayload | undefined =
    (event as LiquidAjaxCartRequestEndEvent).detail?.cart ?? window.liquidAjaxCart?.cart;

  if (typeof _cart?.item_count !== 'number') {
    consoleMessage('Cart: request-end carried no cart', 'warn');
    return;
  }

  window.__NS__.cart.count = _cart.item_count;
  window.__NS__.cart.total = _cart.total_price ?? 0;

  dispatchStoreEvent(EVENTS.CART_UPDATED, { count: _cart.item_count });
  document.dispatchEvent(buildLinesUpdateEvent(_cart.item_count));
});
