import { animate, inView, stagger } from 'motion';
import { __NS_TITLE__Element } from '@/core';
import { defineElement } from '@/utils';
import { REVEAL } from '@/constants';
import type { RevealTargets } from './reveal.types';

/**
 * Staggered entrance for whatever it wraps, driven by Motion.
 *
 * Nothing is hidden by the stylesheet. The element hides its own targets with
 * inline styles the moment before it animates them, and clears those styles the
 * moment it is done or torn down, so content cannot be left invisible by a
 * failed bundle, a hidden tab, a headless render, or a theme-editor re-render.
 *
 * In the editor every section reveals on mount: a merchant selecting a section
 * expects to see it, not to scroll it into view first.
 */
export class Reveal extends __NS_TITLE__Element {
  private targets: RevealTargets = { blocks: [], words: [] };
  private stop: VoidFunction | null = null;
  private timer = 0;
  private played = false;

  protected mounted(): void {
    this.targets = this.collect();

    if (!this.targets.blocks.length && !this.targets.words.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.arm();

    if (this.dataset.trigger === 'load' || window.Shopify?.designMode) {
      this.play();
      return;
    }

    this.stop = inView(this, () => this.play(), {
      margin: REVEAL.ROOT_MARGIN,
      amount: REVEAL.AMOUNT,
    });

    // An observer that never fires must not cost the visitor the content.
    this.timer = window.setTimeout(() => this.play(), REVEAL.FALLBACK);
  }

  protected unmounted(): void {
    this.stop?.();
    this.stop = null;
    window.clearTimeout(this.timer);

    // Teardown happens on a move as well as a removal, so the element leaves
    // its targets visible rather than mid-animation.
    this.clear();
  }

  /// Words come from the heading snippet and move on their own; a heading that
  /// has been split must not also move as a block, or it travels twice.
  private collect(): RevealTargets {
    const _words = Array.from(this.querySelectorAll<HTMLElement>('.__NS__-heading__word-inner'));
    const _blocks = Array.from(this.querySelectorAll<HTMLElement>('[data-reveal]')).filter(
      (_block) => !_block.querySelector('.__NS__-heading__word-inner')
    );

    return { blocks: _blocks, words: _words };
  }

  private arm(): void {
    for (const _block of this.targets.blocks) {
      _block.style.opacity = '0';
      _block.style.transform = `translate3d(0, ${REVEAL.BLOCK_OFFSET}, 0)`;
    }

    for (const _word of this.targets.words) {
      _word.style.opacity = '0';
      _word.style.transform = 'translate3d(0, 100%, 0)';
    }
  }

  private clear(): void {
    for (const _target of [...this.targets.blocks, ...this.targets.words]) {
      _target.style.removeProperty('opacity');
      _target.style.removeProperty('transform');
    }
  }

  private play(): void {
    if (this.played) return;

    this.played = true;
    this.stop?.();
    this.stop = null;
    window.clearTimeout(this.timer);

    const _settled: Promise<unknown>[] = [];

    if (this.targets.blocks.length) {
      _settled.push(
        animate(
          this.targets.blocks,
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          {
            duration: REVEAL.DURATION,
            ease: REVEAL.EASE,
            delay: stagger(REVEAL.BLOCK_STAGGER),
          }
        ).finished
      );
    }

    if (this.targets.words.length) {
      _settled.push(
        animate(
          this.targets.words,
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          {
            duration: REVEAL.DURATION,
            ease: REVEAL.EASE,
            delay: stagger(REVEAL.WORD_STAGGER),
          }
        ).finished
      );
    }

    // Inline styles are scaffolding, not state: once the entrance is over the
    // element owns nothing, so a later re-render starts from the stylesheet.
    void Promise.all(_settled)
      .then(() => this.clear())
      .catch(() => this.clear());
  }
}

defineElement('__NS__-reveal', Reveal);
