import { describe, it, expect, vi } from 'vitest';
import { RunnerOutput } from '../../runner/runner-output';

function harness(content = 'Seed\n') {
  let note = content;
  let current = true;
  const adapter = {
    withLock: vi.fn(async (operation: () => Promise<void>) => { await operation(); }),
    read: vi.fn(async () => note),
    write: vi.fn(async (next: string) => { note = next; }),
    separator: () => '\n',
    isCurrent: () => current,
  };
  return { adapter, output: new RunnerOutput(adapter), note: () => note,
    dispose: () => { current = false; } };
}

const delta = { text: '\nFinding', hasSyntheticLeadingSeparator: true };

describe('RunnerOutput acknowledgement', () => {
  it('retains output on a read failure, then retries against fresh note contents', async () => {
    const h = harness();
    h.adapter.read.mockRejectedValueOnce(new Error('unavailable'));
    h.output.accept(delta);
    await expect(h.output.flush()).rejects.toThrow('unavailable');
    expect(h.output.isBlocked()).toBe(true);
    expect(h.output.isWriting()).toBe(false);
    await h.adapter.write('Edited\n');
    await h.output.flush();
    expect(h.note()).toBe('Edited\nFinding');
    expect(h.output.isBlocked()).toBe(false);
    await h.output.flush();
    expect(h.adapter.write).toHaveBeenCalledTimes(2);
  });

  it('retains rejected writes and writes once on recovery', async () => {
    const h = harness();
    h.adapter.write.mockRejectedValueOnce(new Error('read-only'));
    h.output.accept(delta);
    await expect(h.output.flush()).rejects.toThrow('read-only');
    expect(h.note()).toBe('Seed\n');
    await h.output.flush();
    expect(h.note()).toBe('Seed\nFinding');
  });

  it('recognizes a write that reached disk before its promise rejected', async () => {
    const h = harness();
    const write = h.adapter.write.getMockImplementation()!;
    h.adapter.write.mockImplementationOnce(async (next) => {
      await write(next);
      throw new Error('late acknowledgement failed');
    });
    h.output.accept(delta);
    await expect(h.output.flush()).rejects.toThrow();
    await h.output.flush();
    expect(h.note()).toBe('Seed\nFinding');
    expect(h.adapter.write).toHaveBeenCalledTimes(1);
  });

  it('rejects another action and coalesces retries while the write is in flight', async () => {
    const h = harness();
    let release!: (value: string) => void;
    h.adapter.read.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    h.output.accept(delta);
    const writing = h.output.flush();
    expect(h.output.isWriting()).toBe(true);
    expect(() => h.output.accept(delta)).toThrow();
    await h.output.flush();
    release('Seed\n');
    await writing;
    expect(h.adapter.write).toHaveBeenCalledTimes(1);
  });

  it('cancels an unstarted write when disposed during the read', async () => {
    const h = harness();
    h.adapter.read.mockImplementationOnce(async () => { h.dispose(); return 'Seed\n'; });
    h.output.accept(delta);
    await h.output.flush();
    expect(h.adapter.write).not.toHaveBeenCalled();
  });

  it('preserves authored leading whitespace on the first output chunk', async () => {
    const h = harness('Seed\n');
    h.output.accept({ text: '\nFinding', hasSyntheticLeadingSeparator: false });
    await h.output.flush();
    expect(h.note()).toBe('Seed\n\nFinding');
  });
});
