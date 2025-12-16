/**
 * Cross-platform process management for starting/stopping dev servers
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import findProcess from 'find-process';
import treeKill from 'tree-kill';
import type { ProcessInfo, Service, WebperfConfig } from './types.js';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID_FILE = join(__dirname, '..', '.running-pids.json');

interface RunningProcess {
  name: string;
  port: number;
  pid: number;
}

/**
 * Check if a port is in use
 */
export async function isPortInUse(port: number): Promise<boolean> {
  try {
    const list = await findProcess('port', port);
    return list.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get process using a specific port
 */
export async function getProcessOnPort(port: number): Promise<{ pid: number; name: string } | null> {
  try {
    const list = await findProcess('port', port);
    if (list.length > 0) {
      return { pid: list[0].pid, name: list[0].name };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Wait for a port to become available (service started)
 */
export async function waitForPort(port: number, timeoutMs = 60000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 1000;
  
  while (Date.now() - startTime < timeoutMs) {
    if (await isPortInUse(port)) {
      return true;
    }
    await sleep(checkInterval);
  }
  
  return false;
}

/**
 * Wait for a port to become free
 */
export async function waitForPortFree(port: number, timeoutMs = 10000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 500;
  
  while (Date.now() - startTime < timeoutMs) {
    if (!(await isPortInUse(port))) {
      return true;
    }
    await sleep(checkInterval);
  }
  
  return false;
}

/**
 * Kill a process by PID (cross-platform)
 */
export function killProcess(pid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    treeKill(pid, 'SIGKILL', (err) => {
      if (err) {
        // Ignore errors if process already dead
        if (err.message?.includes('No such process') || err.message?.includes('ESRCH')) {
          resolve();
        } else {
          reject(err);
        }
      } else {
        resolve();
      }
    });
  });
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Save running process PIDs to file
 */
function savePids(processes: RunningProcess[]): void {
  writeFileSync(PID_FILE, JSON.stringify(processes, null, 2));
}

/**
 * Load running process PIDs from file
 */
function loadPids(): RunningProcess[] {
  try {
    if (existsSync(PID_FILE)) {
      return JSON.parse(readFileSync(PID_FILE, 'utf-8'));
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Clear saved PIDs
 */
function clearPids(): void {
  try {
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Start a process
 */
export function startProcess(
  name: string,
  cwd: string,
  command: string,
  port: number
): ChildProcess {
  const isWindows = process.platform === 'win32';
  
  // Use shell: true for cross-platform compatibility with yarn/npm
  const child = spawn(command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    detached: !isWindows, // detached doesn't work well on Windows
    env: { ...process.env },
  });
  
  if (child.pid) {
    // Save PID for later cleanup
    const pids = loadPids();
    pids.push({ name, port, pid: child.pid });
    savePids(pids);
    
    logger.logSuccess(`${name} started (PID: ${child.pid})`);
  }
  
  return child;
}

/**
 * Start a service
 */
export async function startService(service: Service): Promise<ChildProcess | null> {
  if (!existsSync(service.cwd)) {
    logger.logError(`Service directory not found: ${service.cwd}`);
    return null;
  }
  
  logger.logInfo(`Starting ${service.id}...`);
  return startProcess(service.id, service.cwd, service.command, service.port);
}

/**
 * Start all services from config
 */
export async function startAllServices(config: WebperfConfig): Promise<void> {
  if (config.services.length === 0) {
    logger.logWarn('No services configured.');
    return;
  }
  
  logger.log(logger.cyan('Starting all services...'));
  logger.newline();
  
  for (const service of config.services) {
    await startService(service);
  }
  
  logger.newline();
  logger.logSuccess('All services started!');
}

/**
 * Stop all running processes
 */
export async function stopAll(config: WebperfConfig): Promise<void> {
  logger.log(logger.yellow('Stopping all processes...'));
  
  // First, try to kill PIDs from our tracking file
  const savedPids = loadPids();
  for (const proc of savedPids) {
    try {
      await killProcess(proc.pid);
      logger.log(`  Stopped ${proc.name} (PID: ${proc.pid})`);
    } catch {
      // Process may already be dead
    }
  }
  clearPids();
  
  // Also kill any processes still on our ports
  const allPorts = config.services.map(s => s.port);
  
  for (const port of allPorts) {
    const proc = await getProcessOnPort(port);
    if (proc) {
      try {
        await killProcess(proc.pid);
        logger.log(`  Killed process on port ${port} (PID: ${proc.pid})`);
      } catch {
        // Ignore errors
      }
    }
  }
  
  // Wait for ports to be free
  if (allPorts.length > 0) {
    logger.log(logger.yellow('Waiting for ports to be free...'));
    for (const port of allPorts) {
      await waitForPortFree(port, 5000);
    }
  }
  
  logger.logSuccess('All processes stopped.');
}

/**
 * Get status of all services
 */
export async function getStatus(config: WebperfConfig): Promise<ProcessInfo[]> {
  const results: ProcessInfo[] = [];
  
  for (const service of config.services) {
    const proc = await getProcessOnPort(service.port);
    results.push({
      name: service.id,
      port: service.port,
      pid: proc?.pid,
      running: !!proc,
    });
  }
  
  return results;
}

/**
 * Print status of all services
 */
export async function printStatus(config: WebperfConfig): Promise<void> {
  logger.log(logger.blue('Service Status:'));
  logger.newline();
  
  const statuses = await getStatus(config);
  
  if (statuses.length === 0) {
    logger.log('  No services configured.');
    return;
  }
  
  let runningCount = 0;
  
  for (const status of statuses) {
    if (status.running) {
      runningCount++;
      logger.log(`  ${logger.green('✓')} ${status.name.padEnd(30)} → http://localhost:${status.port}/`);
    } else {
      logger.log(`  ${logger.red('✗')} ${status.name.padEnd(30)} → not running`);
    }
  }
  
  logger.newline();
  if (runningCount === statuses.length) {
    logger.logSuccess(`All ${runningCount}/${statuses.length} services are running!`);
  } else {
    logger.logWarn(`${runningCount}/${statuses.length} services running`);
  }
}

/**
 * Ensure all ports are free before starting
 */
export async function ensurePortsFree(config: WebperfConfig): Promise<void> {
  const allPorts = config.services.map(s => s.port);
  
  let portsInUse = false;
  for (const port of allPorts) {
    if (await isPortInUse(port)) {
      portsInUse = true;
      break;
    }
  }
  
  if (portsInUse) {
    logger.logWarn('Detected running services. Stopping them first...');
    await stopAll(config);
  }
}

/**
 * Wait for all services to be ready
 */
export async function waitForServices(config: WebperfConfig): Promise<boolean> {
  logger.log(logger.yellow('Waiting for services to be ready...'));
  
  const allPorts = config.services.map(s => s.port);
  
  for (const port of allPorts) {
    const ready = await waitForPort(port, 120000);
    if (!ready) {
      logger.logError(`Timeout waiting for port ${port}`);
      return false;
    }
  }
  
  logger.logSuccess('All services are ready!');
  return true;
}

/**
 * Print override script from user's config (if provided)
 */
export function printOverrides(config: WebperfConfig): void {
  if (!config.getOverrideScript) {
    logger.newline();
    logger.log(logger.yellow('No override script configured.'));
    logger.log(logger.dim('  Add getOverrideScript() to your config to enable this feature.'));
    logger.newline();
    return;
  }
  
  logger.newline();
  logger.header('Browser Console Overrides');
  logger.newline();
  logger.log(logger.yellow('Copy-paste this into browser console:'));
  logger.newline();
  logger.log(config.getOverrideScript());
  logger.newline();
}
