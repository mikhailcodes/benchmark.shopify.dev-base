import { __NS_TITLE__Element } from '@/core';
import { defineElement } from '@/utils';
import type { PaginatedFallback } from './paginated.types';

/**
 * Swaps a paginated grid in place instead of navigating to the next page.
 *
 * The links inside are real, resolvable URLs and stay that way: this intercepts
 * the click, asks the Section Rendering API for the same section at the new page
 * and replaces its own contents. With the bundle dead, a middle-click, or a
 * modifier held, the browser follows the link and the page still works.
 *
 * Only this section is fetched rather than the whole document, so the header,
 * the footer and the stylesheet are not re-parsed — and because nothing
 * navigates, the scroll position is simply never touched. That is the point:
 * the visitor stays exactly where they were reading.
 *
 * Focus moves to the results region so a screen reader and a keyboard both land
 * on the new cards; `preventScroll` keeps that from undoing the scroll position
 * we just went to the trouble of preserving.
 */
export class Paginated extends __NS_TITLE__Element {
  private request: AbortController | null = null;

  protected mounted(): void {
    if (!this.dataset.sectionId) return;
    if (!this.ref('pagination')) return;

    this.on(this, 'click', this.handleClick as EventListener);
    this.on(window, 'popstate', this.handlePopState);
  }

  protected unmounted(): void {
    this.request?.abort();
    this.request = null;
  }

  private handleClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const _target = event.target as HTMLElement | null;
    const _link = _target?.closest<HTMLAnchorElement>('[data-ref="pagination"] a');

    if (!_link) return;

    event.preventDefault();
    void this.load(_link.href, 'navigate');
  };

  // Same-document history only, and the only entries in it are the ones pushed
  // below — so every popstate here is a page of this grid.
  private handlePopState = (): void => {
    void this.load(window.location.href, 'ignore');
  };

  private async load(url: string, fallback: PaginatedFallback): Promise<void> {
    const _sectionId = this.dataset.sectionId;
    if (!_sectionId) return;

    this.request?.abort();
    this.request = new AbortController();

    this.classList.add('is-loading');
    this.setAttribute('aria-busy', 'true');

    try {
      const _request = new URL(url, window.location.origin);
      _request.searchParams.set('section_id', _sectionId);

      const _response = await fetch(_request.toString(), { signal: this.request.signal });
      if (!_response.ok) throw new Error(`the section responded ${_response.status}`);

      const _next = new DOMParser()
        .parseFromString(await _response.text(), 'text/html')
        .querySelector(this.localName);

      if (!_next) throw new Error('the response held no matching element');

      this.innerHTML = _next.innerHTML;

      if (fallback === 'navigate') {
        const _clean = new URL(url, window.location.origin);
        _clean.searchParams.delete('section_id');
        window.history.pushState({ __NS__Paginated: true }, '', _clean.toString());
      }

      this.ref<HTMLElement>('results')?.focus({ preventScroll: true });
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;

      this.log('page fetch failed', error);

      // A failed swap must not strand the visitor on a page that looks broken.
      if (fallback === 'navigate') window.location.assign(url);
    } finally {
      this.classList.remove('is-loading');
      this.removeAttribute('aria-busy');
    }
  }
}

defineElement('__NS__-paginated', Paginated);
