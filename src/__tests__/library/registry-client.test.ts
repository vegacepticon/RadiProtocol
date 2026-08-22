import { describe, it, expect, vi } from 'vitest';
import { RegistryClient, normalizeRegistryUrl, DEFAULT_REGISTRY_URL, REGISTRY_URLS } from '../../library/registry-client';
import type { CatalogResponse, ReleaseResponse } from '../../library/registry-model';
import { createEmptyProtocolDocument } from '../../protocol/protocol-document';
import { PACKAGE_MANIFEST_SCHEMA, PACKAGE_MANIFEST_VERSION } from '../../library/library-model';

function makeManifest() {
  return {
    schema: PACKAGE_MANIFEST_SCHEMA, version: PACKAGE_MANIFEST_VERSION,
    packageId: 'chest-ct', releaseVersion: '1.0.0',
    protocolDoc: createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z')),
    protocolSha256: 'a'.repeat(64),
    snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
    catalogEntryId: 'chest-ct', publishedAt: '2026-01-01T00:00:00Z',
  };
}

function okResponse(json: unknown) {
  return { status: 200, text: JSON.stringify(json), json, arrayBuffer: new ArrayBuffer(0), headers: {} };
}

describe('registry-client — normalizeRegistryUrl', () => {
  it('returns empty for empty/undefined', () => {
    expect(normalizeRegistryUrl('')).toBe('');
    expect(normalizeRegistryUrl(undefined)).toBe('');
  });
  it('returns empty for non-https in production (httpsOnly=true)', () => {
    expect(normalizeRegistryUrl('http://example.com')).toBe('');
  });
  it('allows http when httpsOnly=false', () => {
    expect(normalizeRegistryUrl('http://example.com', false)).toBe('http://example.com');
  });
  it('accepts https and strips trailing slash', () => {
    expect(normalizeRegistryUrl('https://example.com/')).toBe('https://example.com');
  });
  it('returns empty for invalid URL', () => {
    expect(normalizeRegistryUrl('not a url')).toBe('');
  });
});

describe('registry-client — fetchCatalog', () => {
  it('returns unavailable when no endpoint configured', async () => {
    const c = new RegistryClient({ baseUrl: '' });
    const r = await c.fetchCatalog();
    expect(r.status).toBe('unavailable');
  });
  it('returns ok with a snapshot for a valid response', async () => {
    const body: CatalogResponse = {
      entries: [{ packageId: 'chest-ct', title: 'Chest CT', description: 'd', author: { displayName: 'X' }, latestVersion: '1.0.0', categories: ['radiology'], updatedAt: 't' }],
      serverTime: 't',
    };
    const requestUrl = vi.fn(async () => okResponse(body));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    const r = await c.fetchCatalog();
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.snapshot.entries).toHaveLength(1);
      expect(r.snapshot.entries[0]!.packageId).toBe('chest-ct');
    }
  });
  it('returns unavailable on network error (no throw)', async () => {
    const requestUrl = vi.fn(async () => { throw new Error('network down'); });
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    const r = await c.fetchCatalog();
    expect(r.status).toBe('unavailable');
  });
  it('returns unavailable on malformed response', async () => {
    const requestUrl = vi.fn(async () => okResponse({ entries: 'not-an-array' }));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    const r = await c.fetchCatalog();
    expect(r.status).toBe('unavailable');
  });
  it('rejects non-https baseUrl (unavailable)', async () => {
    const c = new RegistryClient({ baseUrl: 'http://example.com' });
    expect(c.isUnavailable()).toBe(true);
  });
});

describe('registry-client — fetchRelease', () => {
  it('returns ok with a bundle for a valid response', async () => {
    const body: ReleaseResponse = { manifest: makeManifest() as never, snippetContents: [{ relPath: 'lung.md', content: '# Lung' }] };
    const requestUrl = vi.fn(async () => okResponse(body));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    const r = await c.fetchRelease('chest-ct', '1.0.0');
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.bundle.manifest.packageId).toBe('chest-ct');
      expect(r.bundle.snippetContents[0]!.content).toBe('# Lung');
    }
  });
  it('returns not-found on 404', async () => {
    const requestUrl = vi.fn(async () => ({ status: 404, text: '', json: {}, arrayBuffer: new ArrayBuffer(0), headers: {} }));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    const r = await c.fetchRelease('chest-ct', '9.9.9');
    expect(r.status).toBe('not-found');
  });
  it('returns unavailable when no endpoint configured', async () => {
    const c = new RegistryClient({ baseUrl: '' });
    const r = await c.fetchRelease('chest-ct', '1.0.0');
    expect(r.status).toBe('unavailable');
  });
  it('encodes packageId and version in the URL path', async () => {
    const body: ReleaseResponse = { manifest: makeManifest() as never, snippetContents: [] };
    const requestUrl = vi.fn(async () => okResponse(body));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    await c.fetchRelease('chest ct', '1.0.0');
    expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/packages/chest%20ct/releases/1.0.0' }));
  });
});

describe('registry-client — DEFAULT_REGISTRY_URL / REGISTRY_URLS', () => {
  it('is the production registry (https, provisioned)', () => {
    // The production Community Library endpoint is bundled so the catalog works
    // out of the box. Must stay https (the client rejects non-https defaults).
    expect(DEFAULT_REGISTRY_URL).toBe('https://library.radiprotocol.pro');
    expect(() => new URL(DEFAULT_REGISTRY_URL)).not.toThrow();
    expect(new URL(DEFAULT_REGISTRY_URL).protocol).toBe('https:');
  });

  it('REGISTRY_URLS bundles the pages.dev origin as a fallback mirror', () => {
    // *.pages.dev is ISP-blocked in some regions; the custom domain is primary.
    expect(REGISTRY_URLS.length).toBeGreaterThanOrEqual(2);
    expect(REGISTRY_URLS).toContain('https://radiprotocol.pages.dev');
    for (const u of REGISTRY_URLS) {
      expect(new URL(u).protocol).toBe('https:');
    }
  });

  it('a settings override of \'\' falls through to the bundled mirror list', () => {
    const c = new RegistryClient({ baseUrl: '', requestUrl: (() => undefined) as never });
    expect(c.isUnavailable()).toBe(false);
  });

  it('an explicit override collapses the client to a single endpoint', async () => {
    const requestUrl = vi.fn(async () => okResponse({ entries: [] }));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    await c.fetchCatalog();
    expect(requestUrl).toHaveBeenCalledTimes(1);
    expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/catalog' }));
  });

  it('with no override a network failure on the first mirror falls through to the next', async () => {
    const body: CatalogResponse = {
      entries: [{ packageId: 'chest-ct', title: 'Chest CT', description: 'd', author: { displayName: 'X' }, latestVersion: '1.0.0', categories: ['radiology'], updatedAt: 't' }],
      serverTime: 't',
    };
    const requestUrl = vi.fn()
      .mockRejectedValueOnce(new Error('net::ERR_CONNECTION_RESET'))
      .mockResolvedValueOnce(okResponse(body));
    const c = new RegistryClient({ requestUrl: requestUrl as never });
    const r = await c.fetchCatalog();
    expect(r.status).toBe('ok');
    expect(requestUrl).toHaveBeenCalledTimes(2);
    expect(requestUrl).toHaveBeenNthCalledWith(1, expect.objectContaining({ url: 'https://library.radiprotocol.pro/catalog' }));
    expect(requestUrl).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: 'https://radiprotocol.pages.dev/catalog' }));
  });

  it('with no override an unreachable every-mirror network reports unavailable with the last reason', async () => {
    const requestUrl = vi.fn(async () => { throw new Error('net::ERR_CONNECTION_RESET'); });
    const c = new RegistryClient({ requestUrl: requestUrl as never });
    const r = await c.fetchCatalog();
    expect(r.status).toBe('unavailable');
    if (r.status === 'unavailable') {
      expect(r.reason).toContain('ERR_CONNECTION_RESET');
    }
    expect(requestUrl).toHaveBeenCalledTimes(REGISTRY_URLS.length);
  });
});
