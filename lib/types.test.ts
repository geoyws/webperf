import type {
  BatchResult,
  ComparisonResult,
  MeasurementResult,
  MeasurementSummary,
  ProcessInfo,
  Service,
  TestScenario,
  UserSettings,
  WebperfConfig,
} from './types.js';
import { describe, expect, it } from 'vitest';

describe('types', () => {
  describe('Service', () => {
    it('should have correct shape', () => {
      const service: Service = {
        id: 'my-app',
        cwd: '/path/to/app',
        command: 'npm start',
        port: 3000,
      };
      expect(service.id).toBe('my-app');
      expect(service.cwd).toBe('/path/to/app');
      expect(service.command).toBe('npm start');
      expect(service.port).toBe(3000);
    });
  });

  describe('MeasurementResult', () => {
    it('should have all metric fields', () => {
      const result: MeasurementResult = {
        score: 85,
        fcp: 1200,
        lcp: 2100,
        tbt: 150,
        cls: 0.05,
        si: 1800,
      };
      expect(result.score).toBe(85);
      expect(result.fcp).toBe(1200);
      expect(result.lcp).toBe(2100);
      expect(result.tbt).toBe(150);
      expect(result.cls).toBe(0.05);
      expect(result.si).toBe(1800);
    });
  });

  describe('MeasurementSummary', () => {
    it('should have all required fields with MeasurementResult averages', () => {
      const summary: MeasurementSummary = {
        url: 'https://example.com',
        runs: 5,
        timestamp: '2024-01-15T10-30-00',
        overridesApplied: true,
        averages: {
          score: 85,
          fcp: 1200,
          lcp: 2100,
          tbt: 150,
          cls: 0.05,
          si: 1800,
        },
        range: {
          minScore: 80,
          maxScore: 90,
        },
        rawScores: [80, 85, 90, 85, 85],
      };
      expect(summary.url).toBe('https://example.com');
      expect(summary.runs).toBe(5);
      expect(summary.overridesApplied).toBe(true);
      expect(summary.averages.score).toBe(85);
      expect(summary.averages.fcp).toBe(1200);
      expect(summary.rawScores).toHaveLength(5);
    });

    it('should allow optional note', () => {
      const summary: MeasurementSummary = {
        url: 'https://example.com',
        runs: 5,
        timestamp: '2024-01-15T10-30-00',
        overridesApplied: false,
        note: 'baseline test',
        averages: {
          score: 85,
          fcp: 1200,
          lcp: 2100,
          tbt: 150,
          cls: 0.05,
          si: 1800,
        },
        range: {
          minScore: 80,
          maxScore: 90,
        },
        rawScores: [85],
      };
      expect(summary.note).toBe('baseline test');
    });
  });

  describe('ProcessInfo', () => {
    it('should track running process info', () => {
      const info: ProcessInfo = {
        name: 'my-app',
        port: 3000,
        pid: 12345,
        running: true,
      };
      expect(info.name).toBe('my-app');
      expect(info.running).toBe(true);
      expect(info.pid).toBe(12345);
    });

    it('should allow undefined pid', () => {
      const info: ProcessInfo = {
        name: 'my-app',
        port: 3000,
        running: false,
      };
      expect(info.pid).toBeUndefined();
      expect(info.running).toBe(false);
    });
  });

  describe('WebperfConfig', () => {
    it('should have services array and defaults', () => {
      const config: WebperfConfig = {
        services: [
          { id: 'frontend', cwd: '/app', command: 'npm start', port: 3000 },
          { id: 'api', cwd: '/api', command: 'npm run dev', port: 4000 },
        ],
        defaultUrl: 'http://localhost:3000',
        defaultRuns: 5,
      };
      expect(config.services).toHaveLength(2);
      expect(config.defaultUrl).toBe('http://localhost:3000');
      expect(config.defaultRuns).toBe(5);
    });

    it('should allow optional override functions', () => {
      const config: WebperfConfig = {
        services: [],
        defaultUrl: 'http://localhost:3000',
        defaultRuns: 5,
        applyOverrides: async () => {
          // Custom override logic
        },
        getOverrideScript: () => 'console.log("override");',
      };
      expect(config.applyOverrides).toBeDefined();
      expect(config.getOverrideScript).toBeDefined();
      expect(config.getOverrideScript!()).toBe('console.log("override");');
    });
  });

  describe('UserSettings', () => {
    it('should have all optional fields', () => {
      const settings: UserSettings = {
        defaultRuns: 10,
        defaultUrl: 'https://google.com',
        resultsPath: './custom-results',
        jsonlLogPath: './logs/measurements.jsonl',
        autoOpenResults: true,
        notePrefix: '[my-project]',
      };
      expect(settings.defaultRuns).toBe(10);
      expect(settings.defaultUrl).toBe('https://google.com');
      expect(settings.resultsPath).toBe('./custom-results');
      expect(settings.jsonlLogPath).toBe('./logs/measurements.jsonl');
      expect(settings.autoOpenResults).toBe(true);
      expect(settings.notePrefix).toBe('[my-project]');
    });

    it('should allow empty object', () => {
      const settings: UserSettings = {};
      expect(settings.defaultRuns).toBeUndefined();
    });
  });

  describe('ComparisonResult', () => {
    it('should track before/after comparison', () => {
      const comparison: ComparisonResult = {
        metric: 'TBT (ms)',
        before: 500,
        after: 300,
        diff: -200,
        percentChange: -40,
        improved: true,
      };
      expect(comparison.metric).toBe('TBT (ms)');
      expect(comparison.diff).toBe(-200);
      expect(comparison.improved).toBe(true);
    });
  });

  describe('TestScenario', () => {
    it('should have required fields', () => {
      const scenario: TestScenario = {
        id: 'homepage',
        note: 'Homepage baseline test',
        url: 'https://example.com',
      };
      expect(scenario.id).toBe('homepage');
      expect(scenario.note).toBe('Homepage baseline test');
      expect(scenario.url).toBe('https://example.com');
    });

    it('should allow optional fields including tags array', () => {
      const scenario: TestScenario = {
        id: 'dashboard',
        note: 'Dashboard with custom overrides',
        url: 'https://example.com/dashboard',
        runs: 10,
        applyOverrides: true,
        enabled: true,
        tags: ['production', 'critical', 'authenticated'],
      };
      expect(scenario.runs).toBe(10);
      expect(scenario.applyOverrides).toBe(true);
      expect(scenario.enabled).toBe(true);
      expect(scenario.tags).toEqual(['production', 'critical', 'authenticated']);
      expect(scenario.tags).toHaveLength(3);
    });

    it('should allow disabled scenarios', () => {
      const scenario: TestScenario = {
        id: 'wip-feature',
        note: 'Work in progress - skip',
        url: 'https://example.com/wip',
        enabled: false,
      };
      expect(scenario.enabled).toBe(false);
    });

    it('should allow empty tags array', () => {
      const scenario: TestScenario = {
        id: 'untagged',
        note: 'Untagged scenario',
        url: 'https://example.com',
        tags: [],
      };
      expect(scenario.tags).toEqual([]);
    });
  });

  describe('BatchResult', () => {
    it('should track batch execution results with timestamps', () => {
      const batchResult: BatchResult = {
        batchId: '2024-01-15T10-30-00-000Z',
        startedAt: '2024-01-15T10:30:00.000Z',
        completedAt: '2024-01-15T10:30:45.000Z',
        totalScenarios: 3,
        completed: 2,
        failed: 1,
        duration: 45000,
        results: [],
      };
      expect(batchResult.totalScenarios).toBe(3);
      expect(batchResult.completed).toBe(2);
      expect(batchResult.failed).toBe(1);
      expect(batchResult.duration).toBe(45000);
      expect(batchResult.startedAt).toBe('2024-01-15T10:30:00.000Z');
      expect(batchResult.completedAt).toBe('2024-01-15T10:30:45.000Z');
    });

    it('should allow optional tags filter', () => {
      const batchResult: BatchResult = {
        batchId: '2024-01-15T10-30-00-000Z',
        startedAt: '2024-01-15T10:30:00.000Z',
        completedAt: '2024-01-15T10:30:45.000Z',
        tags: ['production', 'critical'],
        totalScenarios: 2,
        completed: 2,
        failed: 0,
        duration: 30000,
        results: [],
      };
      expect(batchResult.tags).toEqual(['production', 'critical']);
    });

    it('should contain individual scenario results with timestamps', () => {
      const scenario: TestScenario = {
        id: 'homepage',
        note: 'Test',
        url: 'https://example.com',
      };
      
      const batchResult: BatchResult = {
        batchId: '2024-01-15T10-30-00-000Z',
        startedAt: '2024-01-15T10:30:00.000Z',
        completedAt: '2024-01-15T10:30:15.000Z',
        totalScenarios: 1,
        completed: 1,
        failed: 0,
        duration: 15000,
        results: [
          {
            scenario,
            summary: {
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
            },
            startedAt: '2024-01-15T10:30:00.000Z',
            completedAt: '2024-01-15T10:30:15.000Z',
          },
        ],
      };
      
      expect(batchResult.results).toHaveLength(1);
      expect(batchResult.results[0].scenario.id).toBe('homepage');
      expect(batchResult.results[0].summary?.averages.score).toBe(85);
      expect(batchResult.results[0].startedAt).toBe('2024-01-15T10:30:00.000Z');
      expect(batchResult.results[0].completedAt).toBe('2024-01-15T10:30:15.000Z');
    });

    it('should track failed scenarios with error and timestamps', () => {
      const batchResult: BatchResult = {
        batchId: '2024-01-15T10-30-00-000Z',
        startedAt: '2024-01-15T10:30:00.000Z',
        completedAt: '2024-01-15T10:30:05.000Z',
        totalScenarios: 1,
        completed: 0,
        failed: 1,
        duration: 5000,
        results: [
          {
            scenario: {
              id: 'broken-page',
              note: 'This page fails',
              url: 'https://example.com/broken',
            },
            error: 'Navigation timeout exceeded',
            startedAt: '2024-01-15T10:30:00.000Z',
            completedAt: '2024-01-15T10:30:05.000Z',
          },
        ],
      };
      
      expect(batchResult.results[0].error).toBe('Navigation timeout exceeded');
      expect(batchResult.results[0].summary).toBeUndefined();
      expect(batchResult.results[0].startedAt).toBeDefined();
    });
  });

  describe('UserSettings with scenarios', () => {
    it('should allow scenarios array with tags', () => {
      const settings: UserSettings = {
        defaultRuns: 5,
        maxConcurrency: 3,
        scenarios: [
          { id: 'test1', note: 'Test 1', url: 'https://example.com/1' },
          { id: 'test2', note: 'Test 2', url: 'https://example.com/2', tags: ['prod', 'critical'] },
        ],
      };
      expect(settings.scenarios).toHaveLength(2);
      expect(settings.maxConcurrency).toBe(3);
      expect(settings.scenarios![1].tags).toEqual(['prod', 'critical']);
    });
  });
});
