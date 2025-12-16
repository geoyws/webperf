import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dirname, join } from 'path';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

import { fileURLToPath } from 'url';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// Mock logger to avoid console output in tests
vi.mock('./logger.js', () => ({
  default: {
    log: vi.fn(),
    logSuccess: vi.fn(),
    logWarn: vi.fn(),
    newline: vi.fn(),
    dim: (s: string) => s,
    cyan: (s: string) => s,
    yellow: (s: string) => s,
  },
  logger: {
    log: vi.fn(),
    logSuccess: vi.fn(),
    logWarn: vi.fn(),
    newline: vi.fn(),
    dim: (s: string) => s,
    cyan: (s: string) => s,
    yellow: (s: string) => s,
  },
}));

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('settings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadSettings', () => {
    it('should return default settings when no settings file exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { loadSettings, clearSettingsCache } = await import('./settings.js');
      clearSettingsCache();
      
      const settings = loadSettings();
      
      expect(settings.defaultRuns).toBe(5);
      expect(settings.defaultUrl).toBe('https://example.com');
      expect(settings.resultsPath).toBe('./results');
    });

    it('should load settings from file when it exists', async () => {
      const mockSettings = {
        defaultRuns: 10,
        defaultUrl: 'https://example.com',
        resultsPath: './custom-results',
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSettings));
      
      const { loadSettings, clearSettingsCache } = await import('./settings.js');
      clearSettingsCache();
      
      const settings = loadSettings();
      
      expect(settings.defaultRuns).toBe(10);
      expect(settings.defaultUrl).toBe('https://example.com');
      expect(settings.resultsPath).toBe('./custom-results');
    });

    it('should merge user settings with defaults', async () => {
      const mockSettings = {
        defaultRuns: 10,
        // Only override defaultRuns, others should come from defaults
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSettings));
      
      const { loadSettings, clearSettingsCache } = await import('./settings.js');
      clearSettingsCache();
      
      const settings = loadSettings();
      
      expect(settings.defaultRuns).toBe(10);
      expect(settings.defaultUrl).toBe('https://example.com'); // default
      expect(settings.resultsPath).toBe('./results'); // default
    });

    it('should return defaults on JSON parse error', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json {{{');
      
      const { loadSettings, clearSettingsCache } = await import('./settings.js');
      clearSettingsCache();
      
      const settings = loadSettings();
      
      expect(settings.defaultRuns).toBe(5);
    });

    it('should cache settings after first load', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { loadSettings, clearSettingsCache } = await import('./settings.js');
      clearSettingsCache();
      
      // First call
      const settings1 = loadSettings();
      // Second call
      const settings2 = loadSettings();
      
      expect(settings1).toBe(settings2); // Same object reference
    });
  });

  describe('getSetting', () => {
    it('should return specific setting value', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { getSetting, clearSettingsCache } = await import('./settings.js');
      clearSettingsCache();
      
      const runs = getSetting('defaultRuns');
      
      expect(runs).toBe(5);
    });
  });

  describe('resolveSettingsPath', () => {
    it('should return absolute paths unchanged', async () => {
      const { resolveSettingsPath } = await import('./settings.js');
      
      const result = resolveSettingsPath('/absolute/path/to/file');
      
      expect(result).toBe('/absolute/path/to/file');
    });

    it('should resolve relative paths from webperf directory', async () => {
      const { resolveSettingsPath } = await import('./settings.js');
      
      const result = resolveSettingsPath('./results');
      
      expect(result).toContain('results');
      expect(result).not.toBe('./results');
    });
  });

  describe('getResultsPath', () => {
    it('should return resolved results path', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { getResultsPath, clearSettingsCache } = await import('./settings.js');
      clearSettingsCache();
      
      const path = getResultsPath();
      
      expect(path).toContain('results');
    });
  });

  describe('getJsonlLogPath', () => {
    it('should return resolved JSONL log path', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { getJsonlLogPath, clearSettingsCache } = await import('./settings.js');
      clearSettingsCache();
      
      const path = getJsonlLogPath();
      
      expect(path).toContain('measurements.jsonl');
    });
  });

  describe('getConfigPath', () => {
    it('should return null when no configPath set', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { getConfigPath, clearSettingsCache } = await import('./settings.js');
      clearSettingsCache();
      
      const path = getConfigPath();
      
      expect(path).toBeNull();
    });

    it('should return resolved path when configPath is set', async () => {
      const mockSettings = {
        configPath: '../webperf.config.ts',
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSettings));
      
      const { getConfigPath, clearSettingsCache } = await import('./settings.js');
      clearSettingsCache();
      
      const path = getConfigPath();
      
      expect(path).not.toBeNull();
      expect(path).toContain('webperf.config.ts');
    });
  });

  describe('createDefaultSettings', () => {
    it('should create settings file with default values', async () => {
      const { createDefaultSettings } = await import('./settings.js');
      
      createDefaultSettings('/tmp/test-settings.json');
      
      expect(writeFileSync).toHaveBeenCalledWith(
        '/tmp/test-settings.json',
        expect.stringContaining('defaultRuns')
      );
    });

    it('should include configPath in created settings', async () => {
      const { createDefaultSettings } = await import('./settings.js');
      
      createDefaultSettings('/tmp/test-settings.json');
      
      const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('configPath');
    });
  });

  describe('findSettingsPath', () => {
    it('should return null when no settings file found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { findSettingsPath } = await import('./settings.js');
      
      const path = findSettingsPath();
      
      expect(path).toBeNull();
    });

    it('should return first found settings path', async () => {
      // First call returns true (settings.json exists)
      vi.mocked(existsSync).mockReturnValueOnce(true);
      
      const { findSettingsPath } = await import('./settings.js');
      
      const path = findSettingsPath();
      
      expect(path).not.toBeNull();
      expect(path).toContain('settings.json');
    });
  });

  describe('clearSettingsCache', () => {
    it('should clear cached settings', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { loadSettings, clearSettingsCache } = await import('./settings.js');
      
      // Load settings
      const settings1 = loadSettings();
      
      // Clear cache
      clearSettingsCache();
      
      // Load again - should not be same reference
      const settings2 = loadSettings();
      
      // They should have same values but not be same object
      expect(settings1).not.toBe(settings2);
      expect(settings1.defaultRuns).toBe(settings2.defaultRuns);
    });
  });
});
