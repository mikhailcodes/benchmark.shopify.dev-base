import { __NS_TITLE__Element } from '@/core';
import { defineElement } from '@/utils';
import { BREAKPOINTS, MEDIA } from '@/constants';
import type { MediaConfig } from './media.types';

const DEFAULT_CONFIG: MediaConfig = {
  desktop: '',
  mobile: '',
  useMobile: false,
};

/**
 * Background video over a poster image. The <video> is built here rather than
 * in Liquid because `media` on a <source> is ignored: markup can only offer one
 * file, and a second one hidden in CSS still downloads. Reduced motion never
 * builds it at all, so the poster is the whole experience.
 */
export class Media extends __NS_TITLE__Element {
  private video: HTMLVideoElement | null = null;
  private observer: IntersectionObserver | null = null;

  protected mounted(): void {
    const _config = this.readConfig(DEFAULT_CONFIG);
    const _source = this.pickSource(_config);

    if (!_source) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.video = this.buildVideo(_source);
    this.append(this.video);

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const _entry of entries) this.toggle(_entry.isIntersecting);
      },
      { rootMargin: MEDIA.ROOT_MARGIN }
    );

    this.observer.observe(this);
  }

  protected unmounted(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.video?.pause();
    this.video?.remove();
    this.video = null;
  }

  /// A breakpoint plays its own source or nothing. Falling back across the
  /// breakpoint is how a mobile-only video ends up playing on a desktop whose
  /// slide is an image. Mobile inherits the desktop source only when the block
  /// configures no mobile media of its own.
  private pickSource(config: MediaConfig): string {
    const _isDesktop = window.matchMedia(`(min-width: ${BREAKPOINTS.MD}px)`).matches;

    if (_isDesktop) return config.desktop;

    return config.useMobile ? config.mobile : config.desktop;
  }

  private buildVideo(source: string): HTMLVideoElement {
    const _video = document.createElement('video');

    _video.className = '__NS__-media__video';
    _video.src = source;
    _video.muted = true;
    _video.loop = true;
    _video.playsInline = true;
    _video.preload = 'none';
    _video.setAttribute('aria-hidden', 'true');
    _video.setAttribute('tabindex', '-1');
    _video.setAttribute('disableremoteplayback', '');

    return _video;
  }

  private toggle(isVisible: boolean): void {
    if (!this.video) return;

    if (!isVisible) {
      this.video.pause();
      return;
    }

    // Autoplay is refused on some devices and battery settings. The poster is
    // already behind the video, so a rejection needs no fallback beyond a log.
    void this.video.play().catch(() => this.log('video autoplay refused'));
  }
}

defineElement('__NS__-media', Media);
