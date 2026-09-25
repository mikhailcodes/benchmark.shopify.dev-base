type LogLevel = 'log' | 'info' | 'warn' | 'error';

const LOG_STYLES: Readonly<Record<LogLevel, string>> = {
  log: 'color: #6b7280',
  info: 'color: #3b82f6',
  warn: 'color: #f59e0b',
  error: 'color: #ef4444',
} as const;

export function consoleMessage(
  message: string,
  level: LogLevel = 'log',
  data: unknown = null
): void {
  if (!window.__NS__?.settings?.devMode) return;

  if (data) {
    console[level](`%c[__NS__] ${message}`, LOG_STYLES[level], data);
  } else {
    console[level](`%c[__NS__] ${message}`, LOG_STYLES[level]);
  }
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let _timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (_timeout) clearTimeout(_timeout);
    _timeout = setTimeout(() => fn(...args), wait);
  };
}

export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let _lastTime = 0;

  return (...args: Parameters<T>) => {
    const _now = Date.now();
    if (_now - _lastTime < wait) return;

    _lastTime = _now;
    fn(...args);
  };
}

export function dispatchStoreEvent(name: string, detail: unknown = {}): void {
  window.__NS__.events.dispatchEvent(new CustomEvent(name, { detail }));

  if (window.__NS__.settings.debugEvents) {
    consoleMessage(`Event: ${name}`, 'info', detail);
  }
}

export function subscribeToStoreEvent(
  name: string,
  handler: (event: CustomEvent) => void
): () => void {
  const _handler = handler as EventListener;

  window.__NS__.events.addEventListener(name, _handler);

  return () => window.__NS__.events.removeEventListener(name, _handler);
}

export function defineElement(tag: string, element: CustomElementConstructor): void {
  if (customElements.get(tag)) return;

  customElements.define(tag, element);
}

/**
 * Defers a heavy component's chunk until one of its tags nears the viewport, so
 * pages without the section never download it. Eager registration is cheaper for
 * anything small — the extra request costs more than the code it saves.
 */
export function defineLazy(tag: string, load: () => Promise<unknown>, rootMargin = '200px'): void {
  if (customElements.get(tag)) return;

  const _observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((_entry) => _entry.isIntersecting)) return;

      _observer.disconnect();
      document.removeEventListener('shopify:section:load', scan);
      void load();
    },
    { rootMargin }
  );

  function scan(): void {
    for (const _element of document.querySelectorAll(tag)) _observer.observe(_element);
  }

  scan();
  document.addEventListener('shopify:section:load', scan);
}
