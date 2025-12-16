/**
 * Results storage, retrieval, and comparison
 */

import type { BatchResult, ComparisonResult, MeasurementResult, MeasurementSummary } from './types.js';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { getJsonlLogPath, getResultsPath } from './settings.js';

import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Ensure results directory exists
 */
function ensureResultsDir(): string {
  const resultsDir = getResultsPath();
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }
  return resultsDir;
}

/**
 * Generate timestamp string for session directory and batch IDs
 * Format: "2024-01-15T10-30-00" (19 chars, filesystem-safe)
 */
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Get log file path for a specific tag
 * 
 * Log file structure:
 * - measurements.jsonl           (all measurements)
 * - tags/{tag}.jsonl             (tag-specific, e.g., tags/production.jsonl)
 * - scenarios/{id}.jsonl         (scenario-specific history)
 */
function getLogPathForTag(tag: string): string {
  const resultsDir = getResultsPath();
  const tagsDir = join(resultsDir, 'tags');
  
  // Ensure tags directory exists
  if (!existsSync(tagsDir)) {
    mkdirSync(tagsDir, { recursive: true });
  }
  
  // Sanitize tag name for filename
  const safeTag = tag.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  return join(tagsDir, `${safeTag}.jsonl`);
}

function getLogPathForScenario(scenarioId: string): string {
  const resultsDir = getResultsPath();
  const scenariosDir = join(resultsDir, 'scenarios');
  
  // Ensure scenarios directory exists
  if (!existsSync(scenariosDir)) {
    mkdirSync(scenariosDir, { recursive: true });
  }
  
  // Sanitize scenario ID for filename
  const safeId = scenarioId.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  return join(scenariosDir, `${safeId}.jsonl`);
}

/**
 * Append measurement to JSONL log file(s)
 * @param summary - The measurement summary
 * @param tags - Optional tags for tag-specific logging
 * @param scenarioId - Optional scenario ID for scenario-specific logging
 */
function appendToJsonlLog(summary: MeasurementSummary, tags?: string[], scenarioId?: string): void {
  const mainLogPath = getJsonlLogPath();
  const mainLogDir = dirname(mainLogPath);
  
  // Ensure directory exists
  if (!existsSync(mainLogDir)) {
    mkdirSync(mainLogDir, { recursive: true });
  }
  
  // Add full ISO timestamp if not present
  const entryWithTimestamp = {
    ...summary,
    loggedAt: new Date().toISOString(),
    ...(tags && tags.length > 0 && { tags }),
    ...(scenarioId && { scenarioId }),
  };
  
  const jsonLine = JSON.stringify(entryWithTimestamp) + '\n';
  
  // Always append to main log
  appendFileSync(mainLogPath, jsonLine);
  logger.log(logger.dim(`  → ${mainLogPath}`));
  
  // Append to each tag's log file
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      const tagLogPath = getLogPathForTag(tag);
      appendFileSync(tagLogPath, jsonLine);
      logger.log(logger.dim(`  → ${tagLogPath}`));
    }
  }
  
  // Append to scenario-specific log if scenarioId provided
  if (scenarioId) {
    const scenarioLogPath = getLogPathForScenario(scenarioId);
    appendFileSync(scenarioLogPath, jsonLine);
    logger.log(logger.dim(`  → ${scenarioLogPath}`));
  }
}

/**
 * Options for saving results
 */
export interface SaveResultsOptions {
  url: string;
  runs: number;
  averages: MeasurementResult;
  minScore: number;
  maxScore: number;
  rawScores: number[];
  /** Whether custom overrides were applied */
  overridesApplied: boolean;
  note?: string;
  /** Tags for tag-specific logging */
  tags?: string[];
  /** Scenario ID for scenario-specific logging */
  scenarioId?: string;
}

/**
 * Save measurement results to disk
 */
export function saveResults(options: SaveResultsOptions): string {
  const {
    url,
    runs,
    averages,
    minScore,
    maxScore,
    rawScores,
    overridesApplied,
    note,
    tags,
    scenarioId,
  } = options;

  const resultsDir = ensureResultsDir();
  
  const timestamp = generateTimestamp();
  
  // Create session directory with optional tags prefix
  const tagsPrefix = tags && tags.length > 0 ? tags.join('-') : null;
  const dirName = tagsPrefix 
    ? `${tagsPrefix}--${scenarioId || 'adhoc'}--${timestamp}`
    : timestamp;
  const sessionDir = join(resultsDir, dirName);
  mkdirSync(sessionDir, { recursive: true });
  
  const summary: MeasurementSummary = {
    url,
    runs,
    timestamp,
    overridesApplied,
    ...(note && { note }),
    averages,
    range: {
      minScore,
      maxScore,
    },
    rawScores,
  };
  
  // Save JSON summary
  const summaryPath = join(sessionDir, 'summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  
  // Append to JSONL log(s)
  appendToJsonlLog(summary, tags, scenarioId);
  
  logger.logSuccess(`Results saved to: ${sessionDir}/`);
  
  return sessionDir;
}

/**
 * Load a measurement summary from a file or directory
 */
export function loadSummary(pathOrTimestamp: string): MeasurementSummary | null {
  const resultsDir = getResultsPath();
  let summaryPath = pathOrTimestamp;
  
  // If it's just a timestamp/directory name, construct the full path
  if (!pathOrTimestamp.includes('/') && !pathOrTimestamp.includes('\\')) {
    summaryPath = join(resultsDir, pathOrTimestamp, 'summary.json');
  } else if (!pathOrTimestamp.endsWith('.json')) {
    summaryPath = join(pathOrTimestamp, 'summary.json');
  }
  
  try {
    if (existsSync(summaryPath)) {
      return JSON.parse(readFileSync(summaryPath, 'utf-8'));
    }
  } catch {
    // Ignore parse errors
  }
  
  return null;
}

/**
 * List all saved results
 */
export function listResults(): void {
  const resultsDir = ensureResultsDir();
  
  const dirs = readdirSync(resultsDir)
    .filter(name => {
      const summaryPath = join(resultsDir, name, 'summary.json');
      return existsSync(summaryPath);
    })
    .sort()
    .reverse();
  
  if (dirs.length === 0) {
    logger.logWarn('No results found yet.');
    logger.log(logger.dim(`  Results directory: ${resultsDir}`));
    return;
  }
  
  logger.log(logger.cyan('Saved Performance Results:'));
  logger.log(logger.dim(`  Location: ${resultsDir}`));
  logger.newline();
  
  for (const dir of dirs) {
    const summary = loadSummary(dir);
    if (summary) {
      const score = Math.round(summary.averages.score);
      const scoreColor = logger.scoreColor(score);
      
      if (summary.note) {
        logger.log(`  ${logger.green(dir)} - Score: ${scoreColor} (${summary.runs} runs) - ${logger.magenta(`"${summary.note}"`)}`);
      } else {
        logger.log(`  ${logger.green(dir)} - Score: ${scoreColor} (${summary.runs} runs) - ${summary.url}`);
      }
    }
  }
}

/**
 * Show the most recent result
 */
export function showLastResult(): void {
  const resultsDir = ensureResultsDir();
  
  const dirs = readdirSync(resultsDir)
    .filter(name => existsSync(join(resultsDir, name, 'summary.json')))
    .sort()
    .reverse();
  
  if (dirs.length === 0) {
    logger.logWarn('No results found yet.');
    return;
  }
  
  const lastDir = dirs[0];
  const summary = loadSummary(lastDir);
  
  if (summary) {
    logger.log(logger.cyan(`Last Result: ${lastDir}`));
    logger.newline();
    logger.log(JSON.stringify(summary, null, 2));
  }
}

/**
 * Compare two measurement sessions
 */
export function compareResults(path1: string, path2: string): void {
  const summary1 = loadSummary(path1);
  const summary2 = loadSummary(path2);
  
  if (!summary1) {
    logger.logError(`Could not load results from: ${path1}`);
    return;
  }
  
  if (!summary2) {
    logger.logError(`Could not load results from: ${path2}`);
    return;
  }
  
  logger.header('COMPARISON RESULTS');
  logger.newline();
  
  logger.log(`  ${logger.yellow('Before:')} ${summary1.timestamp}${summary1.note ? ` ("${summary1.note}")` : ''}`);
  logger.log(`  ${logger.yellow('After:')}  ${summary2.timestamp}${summary2.note ? ` ("${summary2.note}")` : ''}`);
  logger.newline();
  
  logger.log(`  ${logger.bold('Metric'.padEnd(30))} ${logger.bold('Before'.padStart(10))} ${logger.bold('After'.padStart(10))} ${logger.bold('Change'.padStart(15))}`);
  logger.separator();
  
  const comparisons: ComparisonResult[] = [
    {
      metric: 'Performance Score',
      before: summary1.averages.score,
      after: summary2.averages.score,
      diff: summary2.averages.score - summary1.averages.score,
      percentChange: ((summary2.averages.score - summary1.averages.score) / summary1.averages.score) * 100,
      improved: summary2.averages.score > summary1.averages.score,
    },
    {
      metric: 'FCP (ms)',
      before: summary1.averages.fcp,
      after: summary2.averages.fcp,
      diff: summary2.averages.fcp - summary1.averages.fcp,
      percentChange: ((summary2.averages.fcp - summary1.averages.fcp) / summary1.averages.fcp) * 100,
      improved: summary2.averages.fcp < summary1.averages.fcp,
    },
    {
      metric: 'LCP (ms)',
      before: summary1.averages.lcp,
      after: summary2.averages.lcp,
      diff: summary2.averages.lcp - summary1.averages.lcp,
      percentChange: ((summary2.averages.lcp - summary1.averages.lcp) / summary1.averages.lcp) * 100,
      improved: summary2.averages.lcp < summary1.averages.lcp,
    },
    {
      metric: 'TBT (ms)',
      before: summary1.averages.tbt,
      after: summary2.averages.tbt,
      diff: summary2.averages.tbt - summary1.averages.tbt,
      percentChange: ((summary2.averages.tbt - summary1.averages.tbt) / summary1.averages.tbt) * 100,
      improved: summary2.averages.tbt < summary1.averages.tbt,
    },
    {
      metric: 'CLS',
      before: summary1.averages.cls,
      after: summary2.averages.cls,
      diff: summary2.averages.cls - summary1.averages.cls,
      percentChange: ((summary2.averages.cls - summary1.averages.cls) / summary1.averages.cls) * 100,
      improved: summary2.averages.cls < summary1.averages.cls,
    },
    {
      metric: 'Speed Index (ms)',
      before: summary1.averages.si,
      after: summary2.averages.si,
      diff: summary2.averages.si - summary1.averages.si,
      percentChange: ((summary2.averages.si - summary1.averages.si) / summary1.averages.si) * 100,
      improved: summary2.averages.si < summary1.averages.si,
    },
  ];
  
  for (const comp of comparisons) {
    const changeColor = comp.improved ? logger.green : comp.diff === 0 ? logger.gray : logger.red;
    const sign = comp.diff > 0 ? '+' : '';
    
    let beforeStr: string;
    let afterStr: string;
    let diffStr: string;
    
    if (comp.metric === 'CLS') {
      beforeStr = comp.before.toFixed(3);
      afterStr = comp.after.toFixed(3);
      diffStr = `${sign}${comp.diff.toFixed(3)}`;
    } else {
      beforeStr = Math.round(comp.before).toString();
      afterStr = Math.round(comp.after).toString();
      diffStr = `${sign}${Math.round(comp.diff)} (${sign}${comp.percentChange.toFixed(1)}%)`;
    }
    
    logger.log(`  ${comp.metric.padEnd(30)} ${beforeStr.padStart(10)} ${afterStr.padStart(10)} ${changeColor(diffStr.padStart(15))}`);
  }
  
  logger.newline();
}

/**
 * Save batch result to JSONL log(s)
 * 
 * Writes to:
 * - measurements.batch.jsonl (all batch runs)
 * - tags/{tag}.batch.jsonl (for each tag filter applied)
 */
export function saveBatchResult(batchResult: BatchResult): void {
  const jsonlPath = getJsonlLogPath();
  const jsonlDir = dirname(jsonlPath);
  const resultsDir = getResultsPath();
  
  // Ensure directory exists
  if (!existsSync(jsonlDir)) {
    mkdirSync(jsonlDir, { recursive: true });
  }
  
  // Main batch log
  const batchLogPath = jsonlPath.replace('.jsonl', '.batch.jsonl');
  
  // Append as single line JSON with full timestamps
  const jsonLine = JSON.stringify({
    type: 'batch',
    loggedAt: new Date().toISOString(),
    ...batchResult,
  }) + '\n';
  
  appendFileSync(batchLogPath, jsonLine);
  logger.log(logger.dim(`  → ${batchLogPath}`));
  
  // If batch was filtered by tags, also save to tag-specific batch logs
  if (batchResult.tags && batchResult.tags.length > 0) {
    const tagsDir = join(resultsDir, 'tags');
    if (!existsSync(tagsDir)) {
      mkdirSync(tagsDir, { recursive: true });
    }
    
    for (const tag of batchResult.tags) {
      const safeTag = tag.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const tagBatchLogPath = join(tagsDir, `${safeTag}.batch.jsonl`);
      appendFileSync(tagBatchLogPath, jsonLine);
      logger.log(logger.dim(`  → ${tagBatchLogPath}`));
    }
  }
}

/**
 * List log files by tags and scenarios
 */
export function listLogFiles(): void {
  const resultsDir = getResultsPath();
  const jsonlPath = getJsonlLogPath();
  const jsonlDir = dirname(jsonlPath);
  
  logger.log(logger.cyan('Log Files:'));
  logger.newline();
  
  // List main logs
  if (existsSync(jsonlDir)) {
    const files = readdirSync(jsonlDir).filter(f => f.endsWith('.jsonl')).sort();
    
    if (files.length === 0) {
      logger.log(logger.dim('  No log files yet.'));
    } else {
      for (const file of files) {
        const filePath = join(jsonlDir, file);
        const stats = existsSync(filePath) ? readFileSync(filePath, 'utf-8').split('\n').filter(Boolean).length : 0;
        logger.log(`  ${logger.green(file)} - ${stats} entries`);
      }
    }
  }
  
  // List tag-specific logs
  const tagsDir = join(resultsDir, 'tags');
  if (existsSync(tagsDir)) {
    logger.newline();
    logger.log(logger.cyan('Tag Logs:'));
    const tagFiles = readdirSync(tagsDir).filter(f => f.endsWith('.jsonl')).sort();
    
    if (tagFiles.length === 0) {
      logger.log(logger.dim('  No tag logs yet.'));
    } else {
      for (const file of tagFiles) {
        const filePath = join(tagsDir, file);
        const stats = existsSync(filePath) ? readFileSync(filePath, 'utf-8').split('\n').filter(Boolean).length : 0;
        const tagName = file.replace('.jsonl', '').replace('.batch', ' (batch)');
        logger.log(`  ${logger.green(tagName)} - ${stats} entries`);
      }
    }
  }
  
  // List scenario-specific logs
  const scenariosDir = join(resultsDir, 'scenarios');
  if (existsSync(scenariosDir)) {
    logger.newline();
    logger.log(logger.cyan('Scenario Logs:'));
    const scenarioFiles = readdirSync(scenariosDir).filter(f => f.endsWith('.jsonl')).sort();
    
    if (scenarioFiles.length === 0) {
      logger.log(logger.dim('  No scenario logs yet.'));
    } else {
      for (const file of scenarioFiles) {
        const filePath = join(scenariosDir, file);
        const stats = existsSync(filePath) ? readFileSync(filePath, 'utf-8').split('\n').filter(Boolean).length : 0;
        const scenarioId = file.replace('.jsonl', '');
        logger.log(`  ${logger.green(scenarioId)} - ${stats} measurements`);
      }
    }
  }
}

