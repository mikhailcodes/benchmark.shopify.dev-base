import { __NS_TITLE__Element } from '@/core';
import { CART, EVENTS } from '@/constants';
import { defineElement, dispatchStoreEvent } from '@/utils';
import type { CartDrawerConfig } from './cart-drawer.types';
import type { LiquidAjaxCartRequestEndEvent } from '@/types/cart.types';

const DEFAULT_CONFIG: CartDrawerConfig = {
  autoOpen: true,
};

/**
 * The drawer is presentation only.
 *
 * Liquid Ajax Cart owns every write and re-renders [data-ajax-cart-section] —
 * the panel's inner markup — from Liquid after each one. That section sits
 * inside the <dialog> rather than replacing it, so the dialog, its open state,
 * its listeners and the live region all survive a cart change. What would
 * otherwise be a fetch, a parse, a panel swap, a re-bind and a focus restore is
 * nothing at all: this class opens and closes a dialog.
 *
 * The panel is a <dialog> because showModal() brings the focus trap, the inert
 * background, the Escape handler and ::backdrop with it, and every one of those
 * is something a hand-rolled drawer gets subtly wrong.
 */
export class CartDrawer extends __NS_TITLE__Element {
  private config: CartDrawerConfig = DEFAULT_CONFIG;
  private panel: HTMLDialogElement | null = null;

  protected mounted(): void {
    this.panel = this.querySelector<HTMLDialogElement>('[data-ref="panel"]');

    if (!this.panel) {
      this.log('missing panel');
      return;
    }

    this.config = this.readConfig(DEFAULT_CONFIG);

    this.on(this, 'click', this.handleCloseClick);
    this.on(this.panel, 'click', this.handleBackdropClick);
    this.on(this.panel, 'close', this.handleNativeClose);
    this.on(this.panel, 'cancel', this.handleCancel);

    // Capture phase, on the document, because Horizon resolves its own
    // `on:click="#cart-drawer/toggle"` binding while the event bubbles and
    // drops it unless the target extends its Component class. Claiming the
    // click here keeps the header working with no edit to header-actions.
    this.on(document, 'click', this.handleTriggerClick, { capture: true });

    this.on(document, 'liquid-ajax-cart:request-end', this.handleCartRequest);

    // The editor selects a section without making it visible, and a drawer is
    // invisible by definition. Opening on select is what makes the section and
    // its blocks editable at all.
    //
    // Section select fires on the #shopify-section wrapper, which is an
    // ancestor — it can only be caught on the document. Block select fires on
    // the block itself, which is a descendant, so it bubbles through here.
    this.on(document, 'shopify:section:select', this.handleSectionSelect);
    this.on(this, 'shopify:block:select', this.open);
  }

  get isOpen(): boolean {
    return this.panel?.open ?? false;
  }

  open = (): void => {
    if (!this.panel || this.panel.open) return;

    this.panel.showModal();
    this.classList.add('is-open');
    this.syncTriggers(true);
    dispatchStoreEvent(EVENTS.DRAWER_OPEN, { id: CART.DRAWER_ID });
  };

  close = (): void => {
    if (!this.panel?.open) return;

    // The panel keeps .is-open until the slide-out finishes, so the CSS has
    // something to animate from. close() below fires the dialog's own event.
    this.classList.add('is-closing');

    void this.afterPanelAnimations().then(() => {
      this.classList.remove('is-closing');
      this.panel?.close();
    });
  };

  toggle(): void {
    if (this.isOpen) {
      this.close();
      return;
    }

    this.open();
  }

  /**
   * Resolves once every animation the panel owns has settled. An empty list
   * resolves immediately, which is what lets the reduced-motion branch in the
   * stylesheet close instantly rather than hang.
   */
  private async afterPanelAnimations(): Promise<void> {
    if (!this.panel) return;

    const _animations = this.panel.getAnimations({ subtree: false });

    await Promise.allSettled(_animations.map((_animation) => _animation.finished));
  }

  /** Opens itself when a line is added from anywhere on the page. */
  private handleCartRequest = (event: Event): void => {
    const _state = (event as LiquidAjaxCartRequestEndEvent).detail?.requestState;

    if (_state?.requestType !== 'add') return;
    if (!_state.responseData?.ok || !this.config.autoOpen) return;

    this.open();
  };

  private handleTriggerClick = (event: Event): void => {
    const _trigger = (event.target as HTMLElement | null)?.closest(CART.TRIGGER_SELECTOR);
    if (!_trigger) return;

    event.preventDefault();
    event.stopPropagation();

    this.toggle();
  };

  private handleBackdropClick = (event: Event): void => {
    // A click on the dialog element itself is a click on the backdrop: every
    // click on the drawer's own content lands on a descendant instead.
    if (event.target !== this.panel) return;

    this.close();
  };

  // Escape fires `cancel` before `close`. Letting the default through would
  // tear the panel out with no slide-out, so the key routes into close() and
  // rejoins the path every other dismissal takes.
  private handleCancel = (event: Event): void => {
    event.preventDefault();
    this.close();
  };

  private handleSectionSelect = (event: Event): void => {
    const _section = event.target as HTMLElement | null;

    if (!_section?.contains(this)) return;

    this.open();
  };

  private handleNativeClose = (): void => {
    this.classList.remove('is-open', 'is-closing');
    this.syncTriggers(false);
    dispatchStoreEvent(EVENTS.DRAWER_CLOSE, { id: CART.DRAWER_ID });
  };

  /**
   * Every control pointed at the drawer, not just the one that was clicked —
   * the header button and a "view bag" link in the page are the same state, and
   * a screen reader reading one of them stale is worse than reading neither.
   */
  private syncTriggers(expanded: boolean): void {
    for (const _trigger of document.querySelectorAll(CART.TRIGGER_SELECTOR)) {
      _trigger.setAttribute('aria-expanded', String(expanded));
    }
  }

  private handleCloseClick = (event: Event): void => {
    if (!(event.target as HTMLElement | null)?.closest('[data-ref="close"]')) return;

    this.close();
  };
}

defineElement('__NS__-cart-drawer', CartDrawer);
