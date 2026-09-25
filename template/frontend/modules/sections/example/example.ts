import { __NS_TITLE__Element } from '@/core';
import { defineElement } from '@/utils';
import type { ExampleConfig } from './example.types';

const DEFAULT_CONFIG: ExampleConfig = {
  heading: '',
  buttonLabel: '',
};

export class Example extends __NS_TITLE__Element {
  private config: ExampleConfig = DEFAULT_CONFIG;

  protected mounted(): void {
    this.config = this.readConfig(DEFAULT_CONFIG);

    const _action = this.ref('action');
    if (!_action) return;

    this.on(_action, 'click', () => this.classList.toggle('is-active'));

    // Block select is the one editor event with no DOM swap. It bubbles here.
    this.on(this, 'shopify:block:select', (event) => {
      (event.target as HTMLElement)?.scrollIntoView({ block: 'nearest' });
    });
  }
}

defineElement('__NS__-example', Example);
