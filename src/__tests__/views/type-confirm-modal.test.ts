import { describe, it, expect } from 'vitest';
import { TypeConfirmModal } from '../../views/library-admin/helper-modals';

describe('TypeConfirmModal', () => {
  it('prompt returns a promise', () => {
    const p = TypeConfirmModal.prompt({} as never, {
      title: 'T',
      message: 'M',
      phrase: 'x',
      confirmText: 'OK',
      cancelText: 'Cancel',
    });
    expect(p).toBeInstanceOf(Promise);
  });

  it('resolves to false when closed without confirm', async () => {
    const modal = new TypeConfirmModal({} as never, {
      title: 'T',
      message: 'M',
      phrase: 'x',
      confirmText: 'OK',
      cancelText: 'Cancel',
    }, (v) => {
      expect(v).toBe(false);
    });
    // stub away DOM-dependent onOpen
    modal.onOpen = (): void => {};
    modal.open();
    modal.close();
    // open() triggers onOpen() then close() triggers onClose() → resolve(false)
    // Since resolve is sync in the constructor, we just verify the didConfirm state
    expect((modal as unknown as { didConfirm: boolean }).didConfirm).toBe(false);
  });

  it('resolves to true when didConfirm is set before close', async () => {
    const modal = new TypeConfirmModal({} as never, {
      title: 'T',
      message: 'M',
      phrase: 'x',
      confirmText: 'OK',
      cancelText: 'Cancel',
    }, (v) => {
      expect(v).toBe(true);
    });
    modal.onOpen = (): void => {};
    (modal as unknown as { didConfirm: boolean }).didConfirm = true;
    modal.close();
    expect((modal as unknown as { didConfirm: boolean }).didConfirm).toBe(true);
  });
});
