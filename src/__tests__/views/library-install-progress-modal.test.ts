import { describe, expect, it, vi } from 'vitest';
import { LibraryInstallProgressModal } from '../../views/library-install-progress-modal';
import type { LibraryInstallResult } from '../../library/library-service';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function makePlugin(installResult: Promise<LibraryInstallResult>) {
  return {
    libraryService: {
      install: vi.fn(() => installResult),
    },
    i18n: {
      t: (key: string, vars?: Record<string, string>) =>
        vars?.path === undefined ? key : `${key}:${vars.path}`,
    },
  };
}

interface ModalSubject {
  runInstall: () => Promise<void>;
  state: 'installing' | 'complete' | 'indexing-pending' | 'failed';
  progressEl: { setAttribute: (name: string, value: string) => void };
  fillEl: { style: { width: string } };
  statusEl: { empty: () => void; setText: (text: string) => void };
  closeBtn: { disabled: boolean };
}

function primeModal(modal: LibraryInstallProgressModal) {
  const progressEl = { setAttribute: vi.fn() };
  const fillEl = { style: { width: '' } };
  const statusEl = { empty: vi.fn(), setText: vi.fn() };
  const closeBtn = { disabled: true };
  const subject = modal as unknown as ModalSubject;
  Object.assign(subject, { progressEl, fillEl, statusEl, closeBtn });
  return { subject, progressEl, fillEl, statusEl, closeBtn };
}

const PROTOCOL_PATH = 'Protocols/library/chest-ct-3a6b55b27699/1-0-0/chest-ct-3a6b55b27699.rp.json';

const readyResult: LibraryInstallResult = {
  status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0',
  readiness: { status: 'ready', protocolPath: PROTOCOL_PATH },
};

const timedOutResult: LibraryInstallResult = {
  status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0',
  readiness: {
    status: 'timed-out', protocolPath: PROTOCOL_PATH, timeoutMs: 5_000,
  },
};

const failedResult: LibraryInstallResult = {
  status: 'failed', packageId: 'chest-ct', releaseVersion: '1.0.0', reason: 'commit failed',
};

describe('LibraryInstallProgressModal — completion and readiness', () => {
  it('settles completion after the modal was dismissed during installation', async () => {
    const pending = deferred<LibraryInstallResult>();
    const modal = new LibraryInstallProgressModal({} as never, makePlugin(pending.promise) as never, 'chest-ct', '1.0.0');
    const { subject, statusEl } = primeModal(modal);
    const run = subject.runInstall();

    modal.onClose();
    await expect(modal.result).resolves.toEqual({ done: false });
    pending.resolve(readyResult);

    await run;
    await expect(modal.completion).resolves.toEqual(readyResult);
    expect(subject.state).toBe('installing');
    expect(statusEl.setText).not.toHaveBeenCalled();
  });

  it('renders committed timeout as indexing-pending at 100 percent', async () => {
    const modal = new LibraryInstallProgressModal(
      {} as never, makePlugin(Promise.resolve(timedOutResult)) as never, 'chest-ct', '1.0.0',
    );
    const { subject, progressEl, fillEl, statusEl, closeBtn } = primeModal(modal);

    await subject.runInstall();

    await expect(modal.completion).resolves.toEqual(timedOutResult);
    expect(subject.state).toBe('indexing-pending');
    expect(fillEl.style.width).toBe('100%');
    expect(progressEl.setAttribute).toHaveBeenCalledWith('aria-valuenow', '100');
    expect(statusEl.setText).toHaveBeenCalledWith(`library.installIndexPending:${PROTOCOL_PATH}`);
    expect(closeBtn.disabled).toBe(false);
  });

  it.each([
    { result: readyResult, state: 'complete', progress: '100%' },
    { result: failedResult, state: 'failed', progress: '0%' },
  ] as const)('maps $state to its terminal progress', async ({ result, state, progress }) => {
    const modal = new LibraryInstallProgressModal(
      {} as never, makePlugin(Promise.resolve(result)) as never, 'chest-ct', '1.0.0',
    );
    const { subject, fillEl, closeBtn } = primeModal(modal);

    await subject.runInstall();

    expect(subject.state).toBe(state);
    expect(fillEl.style.width).toBe(progress);
    expect(closeBtn.disabled).toBe(false);
  });
});
