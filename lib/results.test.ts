import type { MeasurementResult, MeasurementSummary } from './types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    appendFileSync: vi.fn(),
  };
});

// Mock settings module
vi.mock('./settings.js', () => ({
  getResultsPath: vi.fn(() => '/mock/results'),
  getJsonlLogPath: vi.fn(() => '/mock/results/measurements.jsonl'),
}));

// Mock logger
vi.mock('./logger.js', () => ({
  default: {
    log: vi.fn(),
    logSuccess: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    newline: vi.fn(),
    header: vi.fn(),
    separator: vi.fn(),
    dim: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    magenta: (s: string) => s,
    bold: (s: string) => s,
    scoreColor: (n: number) => String(n),
  },
  logger: {
    log: vi.fn(),
    logSuccess: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    newline: vi.fn(),
    header: vi.fn(),
    separator: vi.fn(),
    dim: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    magenta: (s: string) => s,
    bold: (s: string) => s,
    scoreColor: (n: number) => String(n),
  },
}));


describe('results', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('saveResults', () => {
    it('should create results directory if it does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { saveResults } = await import('./results.js');
      
      const averages: MeasurementResult = {
        score: 85,
        fcp: 1200,
        lcp: 2100,
        tbt: 150,
        cls: 0.05,
        si: 1800,
      };
      
      saveResults({
        url: 'https://example.com',
        runs: 5,
        averages,
        minScore: 80,
        maxScore: 90,
        rawScores: [80, 85, 90, 85, 85],
        overridesApplied: false,
      });
      
      expect(mkdirSync).toHaveBeenCalled();
    });

    it('should save summary.json with correct data', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { saveResults } = await import('./results.js');
      
      const averages: MeasurementResult = {
        score: 85,
        fcp: 1200,
        lcp: 2100,
        tbt: 150,
        cls: 0.05,
        si: 1800,
      };
      
      saveResults({
        url: 'https://example.com',
        runs: 5,
        averages,
        minScore: 80,
        maxScore: 90,
        rawScores: [80, 85, 90, 85, 85],
        overridesApplied: true,
        note: 'test note',
      });
      
      // Check that writeFileSync was called with summary.json
      const writeCall = vi.mocked(writeFileSync).mock.calls.find(
        call => (call[0] as string).includes('summary.json')
      );
      
      expect(writeCall).toBeDefined();
      
      const writtenData = JSON.parse(writeCall![1] as string);
      expect(writtenData.url).toBe('https://example.com');
      expect(writtenData.runs).toBe(5);
      expect(writtenData.overridesApplied).toBe(true);
      expect(writtenData.note).toBe('test note');
      expect(writtenData.averages.score).toBe(85);
      expect(writtenData.range.minScore).toBe(80);
      expect(writtenData.range.maxScore).toBe(90);
    });

    it('should append to JSONL log', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { saveResults } = await import('./results.js');
      
      const averages: MeasurementResult = {
        score: 85,
        fcp: 1200,
        lcp: 2100,
        tbt: 150,
        cls: 0.05,
        si: 1800,
      };
      
      saveResults({
        url: 'https://example.com',
        runs: 5,
        averages,
        minScore: 80,
        maxScore: 90,
        rawScores: [85],
        overridesApplied: false,
      });
      
      expect(appendFileSync).toHaveBeenCalled();
      
      const appendCall = vi.mocked(appendFileSync).mock.calls[0];
      expect(appendCall[0]).toContain('measurements.jsonl');
      
      // Should be valid JSON line
      const jsonLine = appendCall[1] as string;
      expect(jsonLine).toContain('\n');
      const parsed = JSON.parse(jsonLine.trim());
      expect(parsed.url).toBe('https://example.com');
    });

    it('should return session directory path', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { saveResults } = await import('./results.js');
      
      const averages: MeasurementResult = {
        score: 85,
        fcp: 1200,
        lcp: 2100,
        tbt: 150,
        cls: 0.05,
        si: 1800,
      };
      
      const result = saveResults({
        url: 'https://example.com',
        runs: 5,
        averages,
        minScore: 80,
        maxScore: 90,
        rawScores: [85],
        overridesApplied: false,
      });
      
      expect(result).toContain('2024-01-15');
    });
  });

  describe('loadSummary', () => {
    it('should load summary from timestamp directory', async () => {
      const mockSummary: MeasurementSummary = {
        url: 'https://example.com',
        runs: 5,
        timestamp: '2024-01-15T10-30-00',
        overridesApplied: false,
        averages: {
          score: 85,
          fcp: 1200,
          lcp: 2100,
          tbt: 150,
          cls: 0.05,
          si: 1800,
        },
        range: { minScore: 80, maxScore: 90 },
        rawScores: [85],
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSummary));
      
      const { loadSummary } = await import('./results.js');
      
      const result = loadSummary('2024-01-15T10-30-00');
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://example.com');
      expect(result?.averages.score).toBe(85);
    });

    it('should return null for non-existent file', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { loadSummary } = await import('./results.js');
      
      const result = loadSummary('non-existent');
      
      expect(result).toBeNull();
    });

    it('should return null on parse error', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json');
      
      const { loadSummary } = await import('./results.js');
      
      const result = loadSummary('2024-01-15T10-30-00');
      
      expect(result).toBeNull();
    });
  });

  describe('listResults', () => {
    it('should list all saved results', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        '2024-01-15T10-30-00',
        '2024-01-15T11-00-00',
      ] as any);
      
      const mockSummary: MeasurementSummary = {
        url: 'https://example.com',
        runs: 5,
        timestamp: '2024-01-15T10-30-00',
        overridesApplied: false,
        averages: {
          score: 85,
          fcp: 1200,
          lcp: 2100,
          tbt: 150,
          cls: 0.05,
          si: 1800,
        },
        range: { minScore: 80, maxScore: 90 },
        rawScores: [85],
      };
      
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSummary));
      
      const { listResults } = await import('./results.js');
      const logger = await import('./logger.js');
      
      listResults();
      
      expect(logger.default.log).toHaveBeenCalled();
    });

    it('should handle empty results directory', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (String(path).includes('summary.json')) return false;
        return true;
      });
      vi.mocked(readdirSync).mockReturnValue([]);
      
      const { listResults } = await import('./results.js');
      const logger = await import('./logger.js');
      
      listResults();
      
      expect(logger.default.logWarn).toHaveBeenCalledWith('No results found yet.');
    });
  });

  describe('showLastResult', () => {
    it('should show the most recent result', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        '2024-01-15T10-30-00',
        '2024-01-15T11-00-00',
      ] as any);
      
      const mockSummary: MeasurementSummary = {
        url: 'https://example.com',
        runs: 5,
        timestamp: '2024-01-15T11-00-00',
        overridesApplied: false,
        averages: {
          score: 85,
          fcp: 1200,
          lcp: 2100,
          tbt: 150,
          cls: 0.05,
          si: 1800,
        },
        range: { minScore: 80, maxScore: 90 },
        rawScores: [85],
      };
      
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockSummary));
      
      const { showLastResult } = await import('./results.js');
      const logger = await import('./logger.js');
      
      showLastResult();
      
      expect(logger.default.log).toHaveBeenCalled();
    });
  });

  describe('compareResults', () => {
    it('should compare two measurement summaries', async () => {
      const mockSummary1: MeasurementSummary = {
        url: 'https://example.com',
        runs: 5,
        timestamp: '2024-01-15T10-30-00',
        overridesApplied: false,
        averages: {
          score: 75,
          fcp: 1500,
          lcp: 2500,
          tbt: 300,
          cls: 0.1,
          si: 2000,
        },
        range: { minScore: 70, maxScore: 80 },
        rawScores: [75],
      };
      
      const mockSummary2: MeasurementSummary = {
        url: 'https://example.com',
        runs: 5,
        timestamp: '2024-01-15T11-00-00',
        overridesApplied: false,
        averages: {
          score: 85,
          fcp: 1200,
          lcp: 2100,
          tbt: 150,
          cls: 0.05,
          si: 1800,
        },
        range: { minScore: 80, maxScore: 90 },
        rawScores: [85],
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockSummary1))
        .mockReturnValueOnce(JSON.stringify(mockSummary2));
      
      const { compareResults } = await import('./results.js');
      const logger = await import('./logger.js');
      
      compareResults('file1', 'file2');
      
      expect(logger.default.header).toHaveBeenCalledWith('COMPARISON RESULTS');
    });

    it('should handle missing files', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const { compareResults } = await import('./results.js');
      const logger = await import('./logger.js');
      
      compareResults('missing1', 'missing2');
      
      expect(logger.default.logError).toHaveBeenCalled();
    });
  });
});

