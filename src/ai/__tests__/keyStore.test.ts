import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAISettings, loadAISettings, forgetAIKey, keyPersistence, needsKeyAgain, AI_SETTINGS_STORAGE_KEY } from '..';

const S = { mode: 'own_key' as const, ownKey: { kind: 'anthropic' as const, model: 'claude-x', apiKey: 'sk-ant-SECRET-0000000000' } };

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  dump() {
    return JSON.stringify([...this.m]);
  }
}
const localStorage = new MemStorage();
const sessionStorage = new MemStorage();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('sessionStorage', sessionStorage);
});

describe('where the API key is kept (SEC-07)', () => {
  it("'device' keeps the old behaviour: the key is saved with the settings", () => {
    saveAISettings(S, 'device');
    expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toContain('SECRET');
    expect(loadAISettings()?.ownKey?.apiKey).toBe(S.ownKey.apiKey);
  });

  it("'session' keeps the key out of localStorage and in this tab only", () => {
    saveAISettings(S, 'session');
    expect(keyPersistence()).toBe('session');
    expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).not.toContain('SECRET');
    expect(loadAISettings()?.ownKey?.apiKey).toBe(S.ownKey.apiKey);
    sessionStorage.clear(); // the tab was closed
    expect(needsKeyAgain()).toBe(true);
  });

  it("'memory' never writes the key anywhere", () => {
    saveAISettings(S, 'memory');
    expect(localStorage.dump()).not.toContain('SECRET');
    expect(sessionStorage.dump()).not.toContain('SECRET');
  });

  it('forgetAIKey removes it from every place and keeps the other settings', () => {
    saveAISettings(S, 'device');
    forgetAIKey();
    expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).not.toContain('SECRET');
    expect(loadAISettings()?.ownKey?.model).toBe('claude-x');
  });
});
