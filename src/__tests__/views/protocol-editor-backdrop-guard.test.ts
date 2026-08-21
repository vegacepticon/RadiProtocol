import { describe, expect, it } from 'vitest';
import { createModalBackdropCloseGuard } from '../../views/protocol-editor-view';

function makeEl(): HTMLElement {
	return {} as unknown as HTMLElement;
}

describe('createModalBackdropCloseGuard', () => {
	it('does NOT close when a selection starts in an input and ends on the backdrop', () => {
		const backdrop = makeEl();
		const guard = createModalBackdropCloseGuard(backdrop);
		// mousedown inside the modal content (e.g. an input), mouseup over the
		// backdrop: browser dispatches click with the common ancestor target.
		guard.onPointerDown({ target: makeEl() });
		expect(guard.shouldCloseOnClick({ target: backdrop })).toBe(false);
	});

	it('closes when both pointerdown and click land on the backdrop', () => {
		const backdrop = makeEl();
		const guard = createModalBackdropCloseGuard(backdrop);
		guard.onPointerDown({ target: backdrop });
		expect(guard.shouldCloseOnClick({ target: backdrop })).toBe(true);
	});

	it('ignores clicks whose target is not the backdrop', () => {
		const backdrop = makeEl();
		const guard = createModalBackdropCloseGuard(backdrop);
		guard.onPointerDown({ target: backdrop });
		expect(guard.shouldCloseOnClick({ target: makeEl() })).toBe(false);
	});

	it('resists stale presses: one tracked press closes at most once', () => {
		const backdrop = makeEl();
		const guard = createModalBackdropCloseGuard(backdrop);
		guard.onPointerDown({ target: backdrop });
		expect(guard.shouldCloseOnClick({ target: backdrop })).toBe(true);
		// A later click without its own pointerdown must not close again.
		expect(guard.shouldCloseOnClick({ target: backdrop })).toBe(false);
	});

	it('requires a fresh press for each close decision', () => {
		const backdrop = makeEl();
		const guard = createModalBackdropCloseGuard(backdrop);
		guard.onPointerDown({ target: makeEl() });
		expect(guard.shouldCloseOnClick({ target: backdrop })).toBe(false);
		guard.onPointerDown({ target: backdrop });
		expect(guard.shouldCloseOnClick({ target: backdrop })).toBe(true);
	});
});
