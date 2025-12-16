import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from './logger.js';

describe('logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('color functions', () => {
    it('should return colored text for red', () => {
      const result = logger.red('test');
      expect(result).toContain('test');
    });

    it('should return colored text for green', () => {
      const result = logger.green('test');
      expect(result).toContain('test');
    });

    it('should return colored text for yellow', () => {
      const result = logger.yellow('test');
      expect(result).toContain('test');
    });

    it('should return colored text for cyan', () => {
      const result = logger.cyan('test');
      expect(result).toContain('test');
    });

    it('should return bold text', () => {
      const result = logger.bold('test');
      expect(result).toContain('test');
    });
  });

  describe('log methods', () => {
    it('should call console.log', () => {
      logger.log('test message');
      expect(consoleSpy).toHaveBeenCalledWith('test message');
    });

    it('should log success messages with checkmark', () => {
      logger.logSuccess('success');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain('✓');
      expect(call).toContain('success');
    });

    it('should log error messages with X', () => {
      logger.logError('error');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain('✗');
      expect(call).toContain('error');
    });

    it('should log warning messages', () => {
      logger.logWarn('warning');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain('⚠');
      expect(call).toContain('warning');
    });

    it('should log info messages', () => {
      logger.logInfo('info');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain('ℹ');
      expect(call).toContain('info');
    });
  });

  describe('scoreColor', () => {
    it('should return string containing score for >= 90', () => {
      const result = logger.scoreColor(95);
      expect(result).toContain('95');
    });

    it('should return string containing score for 50-89', () => {
      const result = logger.scoreColor(75);
      expect(result).toContain('75');
    });

    it('should return string containing score for < 50', () => {
      const result = logger.scoreColor(30);
      expect(result).toContain('30');
    });
  });

  describe('diffColor', () => {
    it('should return formatted positive diff (higher is better)', () => {
      const result = logger.diffColor(10, false);
      expect(result).toContain('+10');
    });

    it('should return formatted negative diff (lower is better)', () => {
      const result = logger.diffColor(-100, true);
      expect(result).toContain('-100');
    });

    it('should return formatted diff for regressions', () => {
      const result = logger.diffColor(-10, false);
      expect(result).toContain('-10');
    });
  });

  describe('formatting helpers', () => {
    it('should print newline', () => {
      logger.newline();
      expect(consoleSpy).toHaveBeenCalledWith('');
    });

    it('should print separator', () => {
      logger.separator();
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain('─');
    });

    it('should print table row', () => {
      logger.tableRow('Metric', 100, 'ms');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain('Metric');
      expect(call).toContain('100');
      expect(call).toContain('ms');
    });
  });
});

