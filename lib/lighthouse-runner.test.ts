import type { MeasureOptions, MeasurementResult, WebperfConfig } from './types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer';

// Mock puppeteer
const mockPage = {
  goto: vi.fn(),
  evaluate: vi.fn(),
  close: vi.fn(),
};

const mockBrowser = {
  wsEndpoint: vi.fn(() => 'ws://localhost:9222/devtools/browser/xxx'),
  newPage: vi.fn(() => mockPage),
  close: vi.fn(),
};

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(() => mockBrowser),
  },
  launch: vi.fn(() => mockBrowser),
}));

// Mock lighthouse
vi.mock('lighthouse', () => ({
  default: vi.fn(() => ({
    lhr: {
      categories: {
        performance: { score: 0.85 },
      },
      audits: {
        'first-contentful-paint': { numericValue: 1200 },
        'largest-contentful-paint': { numericValue: 2100 },
        'total-blocking-time': { numericValue: 150 },
        'cumulative-layout-shift': { numericValue: 0.05 },
        'speed-index': { numericValue: 1800 },
      },
    },
  })),
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
    tableRow: vi.fn(),
    boxHeader: vi.fn(),
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
    tableRow: vi.fn(),
    boxHeader: vi.fn(),
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    magenta: (s: string) => s,
    bold: (s: string) => s,
    scoreColor: (n: number) => String(n),
  },
}));


describe('lighthouse-runner', () => {
  const mockConfig: WebperfConfig = {
    services: [
      { id: 'frontend', cwd: '/mock/workspace/apps/frontend', command: 'npm start', port: 3000 },
      { id: 'api', cwd: '/mock/workspace/apps/api', command: 'npm run dev', port: 4000 },
    ],
    defaultUrl: 'https://example.com',
    defaultRuns: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.evaluate.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('runMeasurements', () => {
    it('should launch puppeteer with correct options', async () => {
      const { runMeasurements } = await import('./lighthouse-runner.js');
      
      const options: MeasureOptions = {
        url: 'https://example.com',
        runs: 1,
        applyOverrides: false,
      };
      
      await runMeasurements(options, mockConfig);
      
      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
          args: expect.arrayContaining(['--no-sandbox', '--disable-gpu']),
        })
      );
    });

    it('should run lighthouse the specified number of times', async () => {
      const { runMeasurements } = await import('./lighthouse-runner.js');
      
      const options: MeasureOptions = {
        url: 'https://example.com',
        runs: 3,
        applyOverrides: false,
      };
      
      await runMeasurements(options, mockConfig);
      
      expect(lighthouse).toHaveBeenCalledTimes(3);
    });

    it('should return correct metrics structure', async () => {
      const { runMeasurements } = await import('./lighthouse-runner.js');
      
      const options: MeasureOptions = {
        url: 'https://example.com',
        runs: 1,
        applyOverrides: false,
      };
      
      const result = await runMeasurements(options, mockConfig);
      
      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0]).toEqual({
        score: 85,
        fcp: 1200,
        lcp: 2100,
        tbt: 150,
        cls: 0.05,
        si: 1800,
      });
      expect(result.averages).toEqual({
        score: 85,
        fcp: 1200,
        lcp: 2100,
        tbt: 150,
        cls: 0.05,
        si: 1800,
      });
      expect(result.minScore).toBe(85);
      expect(result.maxScore).toBe(85);
    });

    it('should calculate averages correctly for multiple runs', async () => {
      // Mock lighthouse to return different scores
      vi.mocked(lighthouse)
        .mockResolvedValueOnce({
          lhr: {
            categories: { performance: { score: 0.80 } },
            audits: {
              'first-contentful-paint': { numericValue: 1000 },
              'largest-contentful-paint': { numericValue: 2000 },
              'total-blocking-time': { numericValue: 100 },
              'cumulative-layout-shift': { numericValue: 0.04 },
              'speed-index': { numericValue: 1600 },
            },
          },
        } as any)
        .mockResolvedValueOnce({
          lhr: {
            categories: { performance: { score: 0.90 } },
            audits: {
              'first-contentful-paint': { numericValue: 1400 },
              'largest-contentful-paint': { numericValue: 2200 },
              'total-blocking-time': { numericValue: 200 },
              'cumulative-layout-shift': { numericValue: 0.06 },
              'speed-index': { numericValue: 2000 },
            },
          },
        } as any);
      
      const { runMeasurements } = await import('./lighthouse-runner.js');
      
      const options: MeasureOptions = {
        url: 'https://example.com',
        runs: 2,
        applyOverrides: false,
      };
      
      const result = await runMeasurements(options, mockConfig);
      
      expect(result.metrics).toHaveLength(2);
      expect(result.averages.score).toBe(85); // (80 + 90) / 2
      expect(result.averages.fcp).toBe(1200); // (1000 + 1400) / 2
      expect(result.minScore).toBe(80);
      expect(result.maxScore).toBe(90);
    });

    it('should apply custom overrides when enabled and applyOverrides function exists', async () => {
      const mockApplyOverrides = vi.fn();
      const configWithOverrides: WebperfConfig = {
        ...mockConfig,
        applyOverrides: mockApplyOverrides,
      };
      
      const { runMeasurements } = await import('./lighthouse-runner.js');
      
      const options: MeasureOptions = {
        url: 'https://example.com',
        runs: 1,
        applyOverrides: true,
      };
      
      await runMeasurements(options, configWithOverrides);
      
      // Should navigate to page first
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ waitUntil: 'networkidle0' })
      );
      
      // Should call the custom applyOverrides function
      expect(mockApplyOverrides).toHaveBeenCalledWith(mockPage);
      
      // Should close the override page
      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should not apply overrides when applyOverrides is true but no function configured', async () => {
      const { runMeasurements } = await import('./lighthouse-runner.js');
      const logger = await import('./logger.js');
      
      const options: MeasureOptions = {
        url: 'https://example.com',
        runs: 1,
        applyOverrides: true,
      };
      
      await runMeasurements(options, mockConfig); // mockConfig has no applyOverrides function
      
      // Should log a note about missing function
      const logCalls = vi.mocked(logger.default.log).mock.calls;
      const noteCall = logCalls.find(call => 
        (call[0] as string).includes('applyOverrides requested but no applyOverrides function')
      );
      expect(noteCall).toBeDefined();
    });

    it('should close browser even on error', async () => {
      vi.mocked(lighthouse).mockRejectedValueOnce(new Error('Lighthouse error'));
      
      const { runMeasurements } = await import('./lighthouse-runner.js');
      
      const options: MeasureOptions = {
        url: 'https://example.com',
        runs: 1,
        applyOverrides: false,
      };
      
      await expect(runMeasurements(options, mockConfig)).rejects.toThrow('Lighthouse error');
      
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('printResults', () => {
    it('should print formatted results', async () => {
      const { printResults } = await import('./lighthouse-runner.js');
      const logger = await import('./logger.js');
      
      const averages: MeasurementResult = {
        score: 85,
        fcp: 1200,
        lcp: 2100,
        tbt: 150,
        cls: 0.05,
        si: 1800,
      };
      
      printResults(averages, 80, 90, 5, 'test note');
      
      expect(logger.default.header).toHaveBeenCalledWith('PERFORMANCE RESULTS');
      expect(logger.default.tableRow).toHaveBeenCalled();
    });

    it('should show good TBT interpretation for low values', async () => {
      const { printResults } = await import('./lighthouse-runner.js');
      const logger = await import('./logger.js');
      
      const averages: MeasurementResult = {
        score: 95,
        fcp: 1000,
        lcp: 2000,
        tbt: 100, // Good TBT
        cls: 0.05,
        si: 1500,
      };
      
      printResults(averages, 90, 100, 5);
      
      // Should log green message about good TBT
      const logCalls = vi.mocked(logger.default.log).mock.calls;
      const tbtCall = logCalls.find(call => 
        (call[0] as string).includes('TBT < 200ms')
      );
      expect(tbtCall).toBeDefined();
    });

    it('should show warning for high TBT values', async () => {
      const { printResults } = await import('./lighthouse-runner.js');
      const logger = await import('./logger.js');
      
      const averages: MeasurementResult = {
        score: 50,
        fcp: 2000,
        lcp: 4000,
        tbt: 700, // Bad TBT
        cls: 0.1,
        si: 3000,
      };
      
      printResults(averages, 45, 55, 5);
      
      // Should log red warning about high TBT
      const logCalls = vi.mocked(logger.default.log).mock.calls;
      const tbtCall = logCalls.find(call => 
        (call[0] as string).includes('TBT > 600ms')
      );
      expect(tbtCall).toBeDefined();
    });

    it('should show LCP interpretation', async () => {
      const { printResults } = await import('./lighthouse-runner.js');
      const logger = await import('./logger.js');
      
      const averages: MeasurementResult = {
        score: 50,
        fcp: 2000,
        lcp: 5000, // Bad LCP
        tbt: 200,
        cls: 0.1,
        si: 3000,
      };
      
      printResults(averages, 45, 55, 5);
      
      // Should log warning about high LCP
      const logCalls = vi.mocked(logger.default.log).mock.calls;
      const lcpCall = logCalls.find(call => 
        (call[0] as string).includes('LCP > 4s')
      );
      expect(lcpCall).toBeDefined();
    });
  });
});
