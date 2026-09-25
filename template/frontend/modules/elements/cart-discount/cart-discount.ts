import { __NS_TITLE__Element } from '@/core';
import { defineElement } from '@/utils';
import type { CartDiscountConfig } from './cart-discount.types';

const DEFAULT_CONFIG: CartDiscountConfig = {
  invalidMessage: 'That code is not valid for the items in your bag.',
  duplicateMessage: 'That code is already applied.',
};

/**
 * The code awaiting a verdict, held at module scope rather than on the element.
 *
 * This element renders inside [data-ajax-cart-section], so Liquid Ajax Cart
 * destroys and rebuilds it on every cart change — and it re-renders the section
 * before the public request-end event, so the instance that submitted a code is
 * already gone when the answer arrives. Module scope outlives the swap, and the
 * replacement reads the verdict on its own mount.
 */
let pendingCode: string | null = null;

/**
 * The one cart control Liquid Ajax Cart has no attribute for.
 *
 * Shopify exposes no "add a discount" endpoint: /cart/update takes `discount`
 * as the complete list, so applying and removing are both a rewrite of it. The
 * current codes are read back off the rendered pills rather than held in
 * JavaScript, so there is no second copy of the truth to drift.
 *
 * Shopify also answers 200 for a code it rejects, silently returning a cart
 * without it. Asking for the code and seeing whether it came back is the only
 * way to know it failed.
 */
export class CartDiscount extends __NS_TITLE__Element {
  private config: CartDiscountConfig = DEFAULT_CONFIG;
  private input: HTMLInputElement | null = null;
  private error: HTMLElement | null = null;

  protected mounted(): void {
    this.input = this.ref<HTMLInputElement>('discount-input');
    this.error = this.ref('discount-error');

    if (!this.input) {
      this.log('missing input');
      return;
    }

    this.config = this.readConfig(DEFAULT_CONFIG);

    this.on(this, 'click', this.handleClick);
    this.on(this, 'keydown', this.handleKeydown);

    // Only reached when the section was not re-rendered — a failed request.
    this.on(document, 'liquid-ajax-cart:request-end', this.settle);

    this.settle();
  }

  /** The codes Liquid rendered, which is the list Shopify currently holds. */
  private appliedCodes(): string[] {
    return this.refAll('discount-remove')
      .map((_button) => _button.dataset.code ?? '')
      .filter(Boolean);
  }

  private handleClick = (event: Event): void => {
    const _target = event.target as HTMLElement | null;
    if (!_target) return;

    const _remove = _target.closest<HTMLElement>('[data-ref="discount-remove"]');
    if (_remove) {
      const _code = _remove.dataset.code ?? '';
      this.write(this.appliedCodes().filter((_applied) => _applied !== _code));
      return;
    }

    if (!_target.closest('[data-ref="discount-apply"]')) return;

    this.apply();
  };

  private handleKeydown = (event: Event): void => {
    const _event = event as KeyboardEvent;

    if (_event.key !== 'Enter' || _event.target !== this.input) return;

    // Otherwise the checkout form further down the drawer submits.
    _event.preventDefault();
    this.apply();
  };

  private apply(): void {
    const _code = this.input?.value.trim() ?? '';
    if (!_code) return;

    const _applied = this.appliedCodes();

    if (_applied.some((_existing) => this.sameCode(_existing, _code))) {
      this.setError(this.config.duplicateMessage);
      return;
    }

    pendingCode = _code;
    this.setError('');
    this.write([..._applied, _code]);
  }

  private write(codes: readonly string[]): void {
    const _cart = window.liquidAjaxCart;

    if (!_cart) {
      this.log('liquid-ajax-cart is not loaded');
      return;
    }

    this.classList.add('is-loading');
    _cart.update({ discount: codes.join(',') });
  }

  /**
   * Reads the verdict on whatever code was last submitted. Runs on mount,
   * because the instance that submitted it no longer exists by then.
   */
  private settle = (): void => {
    this.classList.remove('is-loading');

    if (!pendingCode) return;

    const _code = pendingCode;
    pendingCode = null;

    if (this.appliedCodes().some((_applied) => this.sameCode(_applied, _code))) {
      this.setError('');
      return;
    }

    // Put the rejected code back: Liquid re-rendered the input empty, and
    // retyping it to fix a typo is worse than seeing it beside the error.
    if (this.input) this.input.value = _code;
    this.setError(this.config.invalidMessage);
  };

  /** Named clear of HTMLElement.matches(), which a `matches` here would shadow. */
  private sameCode(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
  }

  private setError(message: string): void {
    if (!this.error) return;

    this.error.textContent = message;
  }
}

defineElement('__NS__-cart-discount', CartDiscount);
