import type { InlineRunnerLayout } from '../settings';

export interface InlineRunnerViewport {
  width: number;
  height: number;
}

export interface InlineRunnerSize {
  width: number;
  height: number;
}

export const INLINE_RUNNER_DEFAULT_WIDTH = 420;
export const INLINE_RUNNER_DEFAULT_HEIGHT = 320;
export const INLINE_RUNNER_DEFAULT_MARGIN = 16;
export const INLINE_RUNNER_MIN_VISIBLE_WIDTH = 160;
export const INLINE_RUNNER_MIN_VISIBLE_HEADER_HEIGHT = 40;

export function isFiniteInlineRunnerPosition(position: InlineRunnerLayout | null): position is InlineRunnerLayout {
  return position !== null && Number.isFinite(position.left) && Number.isFinite(position.top);
}

/** Phase 60 D-02: never let persisted coordinates place the draggable header fully off-screen. */
export function clampInlineRunnerPosition(
  position: InlineRunnerLayout | null,
  viewport: InlineRunnerViewport,
  size: InlineRunnerSize,
): InlineRunnerLayout | null {
  if (!isFiniteInlineRunnerPosition(position)) return null;

  const visibleWidth = Math.min(Math.max(size.width, INLINE_RUNNER_MIN_VISIBLE_WIDTH), viewport.width);
  const visibleHeight = Math.min(Math.max(size.height, INLINE_RUNNER_MIN_VISIBLE_HEADER_HEIGHT), viewport.height);
  const maxLeft = Math.max(0, viewport.width - Math.min(visibleWidth, INLINE_RUNNER_MIN_VISIBLE_WIDTH));
  const maxTop = Math.max(0, viewport.height - Math.min(visibleHeight, INLINE_RUNNER_MIN_VISIBLE_HEADER_HEIGHT));

  return {
    left: Math.min(Math.max(0, position.left), maxLeft),
    top: Math.min(Math.max(0, position.top), maxTop),
  };
}

/** Phase 67 D-10: extends Phase 60 D-02 clamp-on-restore to width/height.
 *  Position arm reuses the existing clampInlineRunnerPosition (preserves
 *  INLINE_RUNNER_MIN_VISIBLE_WIDTH gating). Size arm clamps to viewport - 32px
 *  (matches the CSS `max-width: calc(100vw - var(--size-4-8))` rule). Missing
 *  or non-finite width/height fall back to defaults (D-06). */
export function clampInlineRunnerLayout(
  layout: InlineRunnerLayout | null,
  viewport: InlineRunnerViewport,
): InlineRunnerLayout | null {
  if (layout === null) return null;
  const positionOnly = clampInlineRunnerPosition(
    { left: layout.left, top: layout.top },
    viewport,
    { width: INLINE_RUNNER_DEFAULT_WIDTH, height: INLINE_RUNNER_DEFAULT_HEIGHT },
  );
  if (positionOnly === null) return null;
  const VIEWPORT_MARGIN_PX = 32;
  const widthIn = (typeof layout.width === 'number' && Number.isFinite(layout.width) && layout.width > 0)
    ? layout.width : INLINE_RUNNER_DEFAULT_WIDTH;
  const heightIn = (typeof layout.height === 'number' && Number.isFinite(layout.height) && layout.height > 0)
    ? layout.height : INLINE_RUNNER_DEFAULT_HEIGHT;
  const width = Math.min(widthIn, Math.max(0, viewport.width - VIEWPORT_MARGIN_PX));
  const height = Math.min(heightIn, Math.max(0, viewport.height - VIEWPORT_MARGIN_PX));
  return { left: positionOnly.left, top: positionOnly.top, width, height };
}

export interface InlineRunnerLayoutManagerOptions {
  containerEl: HTMLElement;
  getSavedLayout: () => InlineRunnerLayout | null;
  saveLayout: (layout: InlineRunnerLayout) => Promise<void> | void;
  getOpenLayouts?: () => Array<InlineRunnerLayout | null>;
}

export class InlineRunnerLayoutManager {
  private readonly containerEl: HTMLElement;
  private readonly getSavedLayout: () => InlineRunnerLayout | null;
  private readonly saveLayout: (layout: InlineRunnerLayout) => Promise<void> | void;
  private readonly getOpenLayouts: () => Array<InlineRunnerLayout | null>;

  private windowResizeHandler: (() => void) | null = null;
  private dragMoveHandler: ((event: PointerEvent) => void) | null = null;
  private dragUpHandler: ((event: PointerEvent) => void) | null = null;
  private isDragging = false;
  /** Phase 67 D-04: tracks active resize gesture so .is-resizing class lifecycle is one-shot. */
  private isResizing = false;
  /** Phase 67 D-04: handle for the 400ms debounce timer between ResizeObserver ticks. */
  private resizeDebounceTimer: number | null = null;

  constructor(options: InlineRunnerLayoutManagerOptions) {
    this.containerEl = options.containerEl;
    this.getSavedLayout = options.getSavedLayout;
    this.saveLayout = options.saveLayout;
    this.getOpenLayouts = options.getOpenLayouts ?? (() => []);
  }

  getViewport(): InlineRunnerViewport {
    return {
      width: Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0),
      height: Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0),
    };
  }

  getContainerSize(): InlineRunnerSize {
    const rect = this.containerEl.getBoundingClientRect();
    return {
      width: Math.max(INLINE_RUNNER_DEFAULT_WIDTH, rect.width),
      height: Math.max(INLINE_RUNNER_DEFAULT_HEIGHT, rect.height),
    };
  }

  getDefaultPosition(): InlineRunnerLayout {
    const viewport = this.getViewport();
    const size = this.getContainerSize();
    return {
      left: Math.max(INLINE_RUNNER_DEFAULT_MARGIN, viewport.width - size.width - INLINE_RUNNER_DEFAULT_MARGIN),
      top: Math.max(INLINE_RUNNER_DEFAULT_MARGIN, viewport.height - size.height - INLINE_RUNNER_DEFAULT_MARGIN),
    };
  }

  applyPosition(position: InlineRunnerLayout): void {
    this.containerEl.style.left = `${Math.round(position.left)}px`;
    this.containerEl.style.top = `${Math.round(position.top)}px`;
    // Phase 67: do NOT clear style.width — the modal is resizable and width must persist across drags
    // this.containerEl.style.width = '';
    this.containerEl.toggleClass('rp-inline-runner-applied-position', true);
  }

  /** Phase 67 D-10: applyPosition + size. Missing width/height ⇒ default fallback. */
  applyLayout(layout: InlineRunnerLayout): void {
    this.applyPosition({ left: layout.left, top: layout.top });
    const width = (typeof layout.width === 'number' && Number.isFinite(layout.width) && layout.width > 0)
      ? layout.width : INLINE_RUNNER_DEFAULT_WIDTH;
    const height = (typeof layout.height === 'number' && Number.isFinite(layout.height) && layout.height > 0)
      ? layout.height : INLINE_RUNNER_DEFAULT_HEIGHT;
    this.containerEl.style.width = `${Math.round(width)}px`;
    this.containerEl.style.height = `${Math.round(height)}px`;
  }

  /** Phase 67 D-06/D-10: restore saved layout (clamped) or apply default. */
  restoreOrDefaultPosition(): void {
    const saved = this.getSavedLayout();
    const viewport = this.getViewport();
    const restored = clampInlineRunnerLayout(saved, viewport);
    if (restored !== null) {
      this.applyLayout(restored);
      return;
    }
    const defaultLayout: InlineRunnerLayout = {
      ...this.getDefaultPosition(),
      width: INLINE_RUNNER_DEFAULT_WIDTH,
      height: INLINE_RUNNER_DEFAULT_HEIGHT,
    };
    const clamped = clampInlineRunnerLayout(defaultLayout, viewport)
      ?? { left: INLINE_RUNNER_DEFAULT_MARGIN, top: INLINE_RUNNER_DEFAULT_MARGIN, width: INLINE_RUNNER_DEFAULT_WIDTH, height: INLINE_RUNNER_DEFAULT_HEIGHT };
    this.applyLayout(clamped);
  }

  /** Phase 85 INLINE-MULTI-02: cascade-or-default position decision.
   *  When opened with no other open inline runners, restores the saved
   *  position (or falls back to the default). When opened while at least one
   *  other inline runner is already open, offsets +24/+24 from the most
   *  recently opened instance, clamped to the viewport, and applies default
   *  width/height — without persisting the cascade position to settings
   *  (the saved global default belongs to drag/resize gestures only). */
  applyInitialLayout(): void {
    const others = this.getOpenLayouts();
    if (others.length === 0) {
      this.restoreOrDefaultPosition();
      return;
    }
    const lastLayout = others[others.length - 1];
    if (lastLayout === null || lastLayout === undefined) {
      this.restoreOrDefaultPosition();
      return;
    }
    const viewport = this.getViewport();
    const containerSize = this.getContainerSize();
    const next = clampInlineRunnerPosition(
      { left: lastLayout.left + 24, top: lastLayout.top + 24 },
      viewport,
      containerSize,
    );
    if (next === null) {
      this.restoreOrDefaultPosition();
      return;
    }
    this.applyPosition(next);
    this.containerEl.style.width = `${INLINE_RUNNER_DEFAULT_WIDTH}px`;
    this.containerEl.style.height = `${INLINE_RUNNER_DEFAULT_HEIGHT}px`;
  }

  /** Phase 85 INLINE-MULTI-02: exposes current applied layout for cascade logic. */
  getAppliedLayout(): InlineRunnerLayout | null {
    const left = Number.parseFloat(this.containerEl.style.left);
    const top = Number.parseFloat(this.containerEl.style.top);
    if (!isFiniteInlineRunnerPosition({ left, top })) return null;
    const width = Number.parseFloat(this.containerEl.style.width);
    const height = Number.parseFloat(this.containerEl.style.height);
    return {
      left,
      top,
      width: Number.isFinite(width) && width > 0 ? width : INLINE_RUNNER_DEFAULT_WIDTH,
      height: Number.isFinite(height) && height > 0 ? height : INLINE_RUNNER_DEFAULT_HEIGHT,
    };
  }

  /** Phase 67 D-11: re-clamp position AND size on viewport change; persist if anything changed. */
  async reclampCurrentPosition(persistIfChanged: boolean): Promise<void> {
    if (this.containerEl.hasClass('is-hidden')) return;
    const currentPosition = this.getAppliedLayout() ?? this.getSavedLayout() ?? this.getDefaultPosition();
    const saved = this.getSavedLayout();
    const styleWidth = Number.parseFloat(this.containerEl.style.width);
    const styleHeight = Number.parseFloat(this.containerEl.style.height);
    const current: InlineRunnerLayout = {
      left: currentPosition.left,
      top: currentPosition.top,
      width: Number.isFinite(styleWidth) && styleWidth > 0 ? styleWidth : (saved?.width ?? INLINE_RUNNER_DEFAULT_WIDTH),
      height: Number.isFinite(styleHeight) && styleHeight > 0 ? styleHeight : (saved?.height ?? INLINE_RUNNER_DEFAULT_HEIGHT),
    };
    const clamped = clampInlineRunnerLayout(current, this.getViewport());
    if (clamped === null) return;
    this.applyLayout(clamped);
    const positionChanged = clamped.left !== current.left || clamped.top !== current.top;
    const sizeChanged = clamped.width !== current.width || clamped.height !== current.height;
    if (persistIfChanged && (positionChanged || sizeChanged)) {
      await this.saveLayout(clamped);
    }
  }

  enableDragging(header: HTMLElement): void {
    header.addEventListener('pointerdown', (event: PointerEvent) => {
      const start = this.getAppliedLayout() ?? this.getDefaultPosition();
      const startX = event.clientX;
      const startY = event.clientY;
      this.isDragging = true;
      this.containerEl.addClass('is-dragging');

      this.dragMoveHandler = (moveEvent: PointerEvent) => {
        const next = clampInlineRunnerPosition(
          { left: start.left + moveEvent.clientX - startX, top: start.top + moveEvent.clientY - startY },
          this.getViewport(),
          this.getContainerSize(),
        );
        if (next !== null) this.applyPosition(next);
      };

      this.dragUpHandler = () => {
        const finalLayout = this.getAppliedLayout();
        this.removeDragListeners();
        if (finalLayout !== null) {
          void this.saveLayout(finalLayout);
        }
      };

      document.addEventListener('pointermove', this.dragMoveHandler);
      document.addEventListener('pointerup', this.dragUpHandler);
    });
  }

  removeDragListeners(): void {
    if (this.dragMoveHandler !== null) {
      document.removeEventListener('pointermove', this.dragMoveHandler);
      this.dragMoveHandler = null;
    }
    if (this.dragUpHandler !== null) {
      document.removeEventListener('pointerup', this.dragUpHandler);
      this.dragUpHandler = null;
    }
    this.containerEl.removeClass('is-dragging');
    this.isDragging = false;
  }

  /** Phase 67 D-04: ResizeObserver tick handler — toggles .is-resizing class and resets the debounce timer.
   *  Saves only on debounce expiry (D-07). Native CSS `resize: both` owns pointer events (D-01). */
  handleResizeTick(): void {
    if (!this.isResizing) {
      this.isResizing = true;
      this.containerEl.addClass('is-resizing');
    }
    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
    }
    this.resizeDebounceTimer = window.setTimeout(() => this.handleResizeDebounceExpire(), 400);
  }

  /** Phase 67 D-07: debounce expiry — read final size, clamp, persist once, clear .is-resizing. */
  handleResizeDebounceExpire(): void {
    this.resizeDebounceTimer = null;
    const appliedLayout = this.getAppliedLayout() ?? this.getDefaultPosition();
    const layout: InlineRunnerLayout = {
      left: appliedLayout.left,
      top: appliedLayout.top,
      width: appliedLayout.width,
      height: appliedLayout.height,
    };
    const clamped = clampInlineRunnerLayout(layout, this.getViewport());
    if (clamped !== null) {
      void this.saveLayout(clamped);
    }
    this.containerEl.removeClass('is-resizing');
    this.isResizing = false;
  }

  /** Phase 60 compatibility shim: layout events now clamp, not note-width-anchor. */
  updateModalPosition(): void {
    void this.reclampCurrentPosition(true);
  }

  startWindowResizeListener(): void {
    if (this.windowResizeHandler !== null) return;
    this.windowResizeHandler = () => {
      void this.reclampCurrentPosition(true);
    };
    window.addEventListener('resize', this.windowResizeHandler);
  }

  destroy(): void {
    if (this.windowResizeHandler !== null) {
      window.removeEventListener('resize', this.windowResizeHandler);
      this.windowResizeHandler = null;
    }
    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }
    this.containerEl.removeClass('is-resizing');
    this.isResizing = false;
    this.removeDragListeners();
  }
}
