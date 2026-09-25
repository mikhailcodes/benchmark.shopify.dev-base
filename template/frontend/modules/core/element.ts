import { consoleMessage } from '@/utils';

export abstract class __NS_TITLE__Element extends HTMLElement {
  private controller: AbortController | null = null;

  protected abstract mounted(): void;

  protected unmounted(): void {}

  connectedCallback(): void {
    // disconnectedCallback also fires when an element is moved, so the mount
    // guard is the controller rather than a one-shot flag.
    if (this.controller) return;

    this.controller = new AbortController();
    this.mounted();
  }

  disconnectedCallback(): void {
    this.controller?.abort();
    this.controller = null;
    this.unmounted();
  }

  protected on(
    target: EventTarget | null,
    type: string,
    handler: EventListener,
    options: AddEventListenerOptions = {}
  ): void {
    if (!target || !this.controller) return;

    target.addEventListener(type, handler, { ...options, signal: this.controller.signal });
  }

  // data-ref, not Horizon's ref: Horizon's Component claims every descendant
  // [ref] without a nearer Component ancestor, including ones inside our tags.
  protected ref<T extends HTMLElement>(name: string): T | null {
    return this.querySelector<T>(`[data-ref="${name}"]`);
  }

  protected refAll<T extends HTMLElement>(name: string): T[] {
    return Array.from(this.querySelectorAll<T>(`[data-ref="${name}"]`));
  }

  protected readConfig<T extends object>(fallback: T): T {
    const _raw = this.dataset.config;
    if (!_raw) return fallback;

    try {
      return { ...fallback, ...JSON.parse(_raw) };
    } catch {
      consoleMessage(`${this.localName}: invalid data-config JSON`, 'warn');
      return fallback;
    }
  }

  protected log(message: string, data: unknown = null): void {
    consoleMessage(`${this.localName}: ${message}`, 'info', data);
  }
}
