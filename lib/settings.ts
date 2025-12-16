/**
 * User settings management
 * Settings are personal preferences that can live outside the repo
 */

import { dirname, isAbsolute, join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

import type { UserSettings } from './types.js';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBPERF_DIR = join(__dirname, '..');

/**
 * Possible locations for settings file (checked in order)
 */
const SETTINGS_PATHS = [
  join(WEBPERF_DIR, 'settings.json'),              // Local to webperf
  join(WEBPERF_DIR, '.webperf-settings.json'),     // Hidden local
  join(homedir(), '.webperf-settings.json'),       // User home directory
];

/**
 * Default settings
 */
const DEFAULT_SETTINGS: UserSettings = {
  configPath: undefined, // Path to external config file
  defaultRuns: 5,
  defaultUrl: 'https://example.com', // Safe default for measure-only mode
  resultsPath: './results',
  jsonlLogPath: './results/measurements.jsonl',
  autoOpenResults: false,
  notePrefix: '',
};

let cachedSettings: UserSettings | null = null;

/**
 * Find the settings file path (first one that exists)
 */
export function findSettingsPath(): string | null {
  for (const path of SETTINGS_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

/**
 * Load user settings from file
 */
export function loadSettings(): UserSettings {
  if (cachedSettings) {
    return cachedSettings;
  }

  const settingsPath = findSettingsPath();
  
  if (settingsPath) {
    try {
      const content = readFileSync(settingsPath, 'utf-8');
      const userSettings = JSON.parse(content) as Partial<UserSettings>;
      cachedSettings = { ...DEFAULT_SETTINGS, ...userSettings };
      logger.log(logger.dim(`Loaded settings from ${settingsPath}`));
    } catch (e) {
      logger.logWarn(`Could not parse settings file: ${settingsPath}`);
      cachedSettings = { ...DEFAULT_SETTINGS };
    }
  } else {
    cachedSettings = { ...DEFAULT_SETTINGS };
  }

  return cachedSettings;
}

/**
 * Get a specific setting value
 */
export function getSetting<K extends keyof UserSettings>(key: K): UserSettings[K] {
  const settings = loadSettings();
  return settings[key];
}

/**
 * Resolve a path setting (handles relative vs absolute)
 */
export function resolveSettingsPath(pathSetting: string): string {
  if (isAbsolute(pathSetting)) {
    return pathSetting;
  }
  return resolve(WEBPERF_DIR, pathSetting);
}

/**
 * Get the results directory path
 */
export function getResultsPath(): string {
  const settings = loadSettings();
  return resolveSettingsPath(settings.resultsPath || './results');
}

/**
 * Get the JSONL log file path
 */
export function getJsonlLogPath(): string {
  const settings = loadSettings();
  return resolveSettingsPath(settings.jsonlLogPath || './results/measurements.jsonl');
}

/**
 * Get the external config file path (if configured)
 */
export function getConfigPath(): string | null {
  const settings = loadSettings();
  if (settings.configPath) {
    return resolveSettingsPath(settings.configPath);
  }
  return null;
}

/**
 * Create a default settings file
 */
export function createDefaultSettings(path?: string): void {
  const settingsPath = path || join(WEBPERF_DIR, 'settings.json');
  
  const settingsContent = {
    _README: 'This file is gitignored - safe to store paths here',
    _IMPORTANT: 'configPath MUST point to a file OUTSIDE this repo to prevent committing sensitive data',
    configPath: '',
    defaultRuns: 5,
    defaultUrl: 'https://example.com',
    resultsPath: './results',
    jsonlLogPath: './results/measurements.jsonl',
    autoOpenResults: false,
    notePrefix: '',
  };

  writeFileSync(settingsPath, JSON.stringify(settingsContent, null, 2));
  logger.logSuccess(`Created settings file: ${settingsPath}`);
  logger.newline();
  logger.log(logger.yellow('Next steps:'));
  logger.log('  1. Create your config file OUTSIDE this repo');
  logger.log('     Example: ~/projects/myapp/webperf.config.ts');
  logger.log('  2. Edit settings.json and set configPath to that file');
  logger.log('  3. Or set WEBPERF_CONFIG_PATH environment variable');
}

/**
 * Print current settings
 */
export function printSettings(): void {
  const settings = loadSettings();
  const settingsPath = findSettingsPath();
  const configPath = getConfigPath();

  logger.log(logger.cyan('Current Settings:'));
  logger.newline();
  
  if (settingsPath) {
    logger.log(`  ${logger.dim('Settings file:')} ${settingsPath}`);
  } else {
    logger.log(`  ${logger.dim('Settings file:')} (using defaults)`);
  }
  
  logger.newline();
  logger.log(`  ${logger.dim('configPath:')}       ${configPath || '(not set - using local or defaults)'}`);
  logger.log(`  ${logger.dim('defaultRuns:')}      ${settings.defaultRuns}`);
  logger.log(`  ${logger.dim('defaultUrl:')}       ${settings.defaultUrl}`);
  logger.log(`  ${logger.dim('resultsPath:')}      ${getResultsPath()}`);
  logger.log(`  ${logger.dim('jsonlLogPath:')}     ${getJsonlLogPath()}`);
  logger.log(`  ${logger.dim('autoOpenResults:')}  ${settings.autoOpenResults}`);
  logger.log(`  ${logger.dim('notePrefix:')}       ${settings.notePrefix || '(none)'}`);
}

/**
 * Clear settings cache (useful for testing)
 */
export function clearSettingsCache(): void {
  cachedSettings = null;
}

