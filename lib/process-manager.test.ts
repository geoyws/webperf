import type { WebperfConfig } from './types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

import findProcess from 'find-process';
import { spawn } from 'child_process';
import treeKill from 'tree-kill';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    pid: 12345,
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  })),
}));

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

// Mock find-process
vi.mock('find-process', () => ({
  default: vi.fn(),
}));

// Mock tree-kill
vi.mock('tree-kill', () => ({
  default: vi.fn((pid, signal, callback) => callback && callback()),
}));

// Mock logger
vi.mock('./logger.js', () => ({
  default: {
    log: vi.fn(),
    logSuccess: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
    newline: vi.fn(),
    header: vi.fn(),
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    blue: (s: string) => s,
    dim: (s: string) => s,
  },
  logger: {
    log: vi.fn(),
    logSuccess: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
    newline: vi.fn(),
    header: vi.fn(),
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    blue: (s: string) => s,
    dim: (s: string) => s,
  },
}));


describe('process-manager', () => {
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
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('[]');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isPortInUse', () => {
    it('should return true when port is in use', async () => {
      vi.mocked(findProcess).mockResolvedValue([{ pid: 123, name: 'node' }] as any);
      
      const { isPortInUse } = await import('./process-manager.js');
      
      const result = await isPortInUse(3000);
      
      expect(result).toBe(true);
      expect(findProcess).toHaveBeenCalledWith('port', 3000);
    });

    it('should return false when port is free', async () => {
      vi.mocked(findProcess).mockResolvedValue([]);
      
      const { isPortInUse } = await import('./process-manager.js');
      
      const result = await isPortInUse(3000);
      
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      vi.mocked(findProcess).mockRejectedValue(new Error('Network error'));
      
      const { isPortInUse } = await import('./process-manager.js');
      
      const result = await isPortInUse(3000);
      
      expect(result).toBe(false);
    });
  });

  describe('getProcessOnPort', () => {
    it('should return process info when found', async () => {
      vi.mocked(findProcess).mockResolvedValue([{ pid: 123, name: 'node' }] as any);
      
      const { getProcessOnPort } = await import('./process-manager.js');
      
      const result = await getProcessOnPort(3000);
      
      expect(result).toEqual({ pid: 123, name: 'node' });
    });

    it('should return null when no process found', async () => {
      vi.mocked(findProcess).mockResolvedValue([]);
      
      const { getProcessOnPort } = await import('./process-manager.js');
      
      const result = await getProcessOnPort(3000);
      
      expect(result).toBeNull();
    });
  });

  describe('killProcess', () => {
    it('should kill process by PID', async () => {
      const { killProcess } = await import('./process-manager.js');
      
      await killProcess(12345);
      
      expect(treeKill).toHaveBeenCalledWith(12345, 'SIGKILL', expect.any(Function));
    });

    it('should resolve even if process not found', async () => {
      vi.mocked(treeKill).mockImplementation((pid, signal, callback) => {
        const error = new Error('No such process');
        error.message = 'No such process';
        callback && callback(error);
      });
      
      const { killProcess } = await import('./process-manager.js');
      
      // Should not throw
      await expect(killProcess(99999)).resolves.toBeUndefined();
    });
  });

  describe('startProcess', () => {
    it('should spawn process with correct parameters', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('[]');
      
      const { startProcess } = await import('./process-manager.js');
      
      const child = startProcess('test-app', '/mock/cwd', 'npm start', 3000);
      
      expect(spawn).toHaveBeenCalledWith(
        'npm start',
        expect.objectContaining({
          cwd: '/mock/cwd',
          shell: true,
        })
      );
      expect(child.pid).toBe(12345);
    });

    it('should save PID to tracking file', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('[]');
      
      const { startProcess } = await import('./process-manager.js');
      
      startProcess('test-app', '/mock/cwd', 'npm start', 3000);
      
      expect(writeFileSync).toHaveBeenCalled();
      const writeCall = vi.mocked(writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData).toContainEqual(
        expect.objectContaining({
          name: 'test-app',
          port: 3000,
          pid: 12345,
        })
      );
    });
  });

  describe('getStatus', () => {
    it('should return status for all services', async () => {
      vi.mocked(findProcess)
        .mockResolvedValueOnce([{ pid: 100, name: 'node' }] as any) // frontend
        .mockResolvedValueOnce([]) // api not running
      ;
      
      const { getStatus } = await import('./process-manager.js');
      
      const statuses = await getStatus(mockConfig);
      
      expect(statuses).toHaveLength(2);
      expect(statuses[0]).toEqual({
        name: 'frontend',
        port: 3000,
        pid: 100,
        running: true,
      });
      expect(statuses[1]).toEqual({
        name: 'api',
        port: 4000,
        pid: undefined,
        running: false,
      });
    });
  });

  describe('stopAll', () => {
    it('should kill all tracked processes', async () => {
      const savedPids = [
        { name: 'frontend', port: 3000, pid: 100 },
        { name: 'api', port: 4000, pid: 101 },
      ];
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(savedPids));
      vi.mocked(findProcess).mockResolvedValue([]);
      
      const { stopAll } = await import('./process-manager.js');
      
      await stopAll(mockConfig);
      
      // Should attempt to kill each saved PID
      expect(treeKill).toHaveBeenCalledWith(100, 'SIGKILL', expect.any(Function));
      expect(treeKill).toHaveBeenCalledWith(101, 'SIGKILL', expect.any(Function));
      
      // Should clear PID file
      expect(unlinkSync).toHaveBeenCalled();
    });
  });

  describe('waitForPort', () => {
    it('should return true when port becomes available', async () => {
      // First call: not in use, second call: in use
      vi.mocked(findProcess)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ pid: 123, name: 'node' }] as any);
      
      const { waitForPort } = await import('./process-manager.js');
      
      const result = await waitForPort(3000, 5000);
      
      expect(result).toBe(true);
    });

    it('should return false on timeout', async () => {
      vi.mocked(findProcess).mockResolvedValue([]);
      
      const { waitForPort } = await import('./process-manager.js');
      
      // Very short timeout
      const result = await waitForPort(3000, 100);
      
      expect(result).toBe(false);
    });
  });

  describe('waitForPortFree', () => {
    it('should return true when port becomes free', async () => {
      vi.mocked(findProcess)
        .mockResolvedValueOnce([{ pid: 123, name: 'node' }] as any)
        .mockResolvedValueOnce([]);
      
      const { waitForPortFree } = await import('./process-manager.js');
      
      const result = await waitForPortFree(3000, 5000);
      
      expect(result).toBe(true);
    });
  });

  describe('printOverrides', () => {
    it('should show message when no override script configured', async () => {
      const { printOverrides } = await import('./process-manager.js');
      const logger = await import('./logger.js');
      
      printOverrides(mockConfig);
      
      expect(logger.default.log).toHaveBeenCalled();
      
      // Should show "no override script" message
      const logCalls = vi.mocked(logger.default.log).mock.calls;
      const noScriptCall = logCalls.find(call => 
        (call[0] as string).includes('No override script configured')
      );
      expect(noScriptCall).toBeDefined();
    });

    it('should print custom override script when configured', async () => {
      const configWithOverrides: WebperfConfig = {
        ...mockConfig,
        getOverrideScript: () => 'console.log("custom override");',
      };
      
      const { printOverrides } = await import('./process-manager.js');
      const logger = await import('./logger.js');
      
      printOverrides(configWithOverrides);
      
      const logCalls = vi.mocked(logger.default.log).mock.calls;
      const overrideCall = logCalls.find(call => 
        (call[0] as string).includes('custom override')
      );
      expect(overrideCall).toBeDefined();
    });
  });

  describe('ensurePortsFree', () => {
    it('should call stopAll if ports are in use', async () => {
      vi.mocked(findProcess).mockResolvedValue([{ pid: 123, name: 'node' }] as any);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('[]');
      
      const { ensurePortsFree } = await import('./process-manager.js');
      const logger = await import('./logger.js');
      
      await ensurePortsFree(mockConfig);
      
      expect(logger.default.logWarn).toHaveBeenCalledWith(
        'Detected running services. Stopping them first...'
      );
    });

    it('should not call stopAll if ports are free', async () => {
      vi.mocked(findProcess).mockResolvedValue([]);
      
      const { ensurePortsFree } = await import('./process-manager.js');
      const logger = await import('./logger.js');
      
      await ensurePortsFree(mockConfig);
      
      expect(logger.default.logWarn).not.toHaveBeenCalled();
    });
  });
});
