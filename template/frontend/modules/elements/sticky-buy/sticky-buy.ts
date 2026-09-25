import { __NS_TITLE__Element } from '@/core';
import { defineElement } from '@/utils';
import type { StickyBuyConfig } from './sticky-buy.types';

const DEFAULT_CONFIG: StickyBuyConfig = {
  anchor: '.buy-buttons-block',
};

/**
 * Shows Horizon's sticky buy bar once the real buy buttons scroll out of view.
 *
 * Horizon's sticky-add-to-cart.js owned this, and it is no longer loaded — it
 * also bound its own add-to-cart, which is the collision this migration exists
 * to remove. Only the visibility half is reproduced here: the button itself is
 * now a plain submit pointed at the product form, so Liquid Ajax Cart adds it
 * on the same path as every other add.
 *
 * The bar ships with data-stuck="false" from Liquid, so a failed bundle leaves
 * it hidden rather than pinned over the page.
 */
export class StickyBuy extends __NS_TITLE__Element {
  private config: StickyBuyConfig = DEFAULT_CONFIG;
  private observer: IntersectionObserver | null = null;
  private bar: HTMLElement | null = null;

  protected mounted(): void {
    this.bar = this.ref('sticky-bar');

    if (!this.bar) {
      this.log('missing bar');
      return;
    }

    this.config = this.readConfig(DEFAULT_CONFIG);

    // No buy buttons on the page means nothing to stand in for.
    const _anchor = document.querySelector(this.config.anchor);
    if (!_anchor) return;

    this.observer = new IntersectionObserver(this.handleIntersect, { threshold: 0 });
    this.observer.observe(_anchor);
  }

  protected unmounted(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /**
   * Stuck only once the buttons have left upward. Scrolling *down* to a product
   * page from a link lower on the page also has them off-screen, and pinning the
   * bar before the visitor has seen the real one is noise.
   */
  private handleIntersect = (entries: IntersectionObserverEntry[]): void => {
    const _entry = entries[0];
    if (!_entry) return;

    const _scrolledPast = !_entry.isIntersecting && _entry.boundingClientRect.top < 0;

    this.bar?.setAttribute('data-stuck', String(_scrolledPast));
  };
}

defineElement('__NS__-sticky-buy', StickyBuy);
