import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const viewSrc = fs.readFileSync(path.resolve(__dirname, '../../views/library-view.ts'), 'utf8');
const enSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf8');
const ruSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ru.json'), 'utf8');

describe('library-view — uninstall UI wiring guard', () => {
  it('has a handleUninstall method that uses ConfirmModal + the facade + explicit refresh', () => {
    expect(viewSrc).toContain('handleUninstall');
    expect(viewSrc).toContain('ConfirmModal');
    expect(viewSrc).toContain('this.plugin.libraryService.uninstall');
    expect(viewSrc).toContain('await this.refresh()');
  });
  it('renders an Uninstall button in renderInstalledRecord', () => {
    expect(viewSrc).toContain('radi-library-uninstall-btn');
    expect(viewSrc).toContain('library.uninstallLabel');
  });
  it('checks the uninstall status (ok/not-installed/failed), not try/catch', () => {
    expect(viewSrc).toContain("'not-installed'");
    expect(viewSrc).toContain('uninstallError');
  });
  it('calls uninstall with (record.packageId, record.releaseVersion) — the facade, not the installer', () => {
    expect(viewSrc).toContain('this.plugin.libraryService.uninstall(record.packageId, record.releaseVersion)');
  });
  it('en/ru uninstall key parity (Check 7)', () => {
    for (const key of ['uninstallLabel', 'uninstallTitle', 'uninstallBody', 'uninstallConfirm', 'uninstalledNotice', 'notInstalledNotice', 'uninstallError']) {
      expect(enSrc).toContain(`"${key}"`);
      expect(ruSrc).toContain(`"${key}"`);
    }
  });
});

describe('library-view — install completion wiring guard', () => {
  it('awaits operation completion then refreshes exactly once for committed success', () => {
    const start = viewSrc.indexOf('private async openInstall');
    const end = viewSrc.indexOf('/** FR-8:', start);
    const body = viewSrc.slice(start, end);

    expect(body).toContain('await modal.completion');
    expect(body).toContain("result.status === 'ok'");
    expect(body.match(/await this\.refresh\(\)/g)).toHaveLength(1);
    expect(body.indexOf('await modal.completion')).toBeLessThan(body.indexOf('await this.refresh()'));
    expect(body).not.toContain('await modal.result');
  });

  it('keeps the en/ru indexing-pending key in parity', () => {
    expect(enSrc).toContain('"installIndexPending"');
    expect(ruSrc).toContain('"installIndexPending"');
  });
});
