/**
 * Lighthouse performance measurement runner
 * Uses Puppeteer + Lighthouse for cross-platform compatibility
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import lighthouse, { Result as LighthouseResult } from 'lighthouse';
import type { MeasurementResult, MeasureOptions, WebperfConfig } from './types.js';
import logger from './logger.js';

/**
 * Apply custom overrides from user's config
 */
async function applyCustomOverrides(page: Page, config: WebperfConfig): Promise<void> {
  if (!config.applyOverrides) {
    logger.log(logger.yellow('No override function configured - skipping overrides.'));
    return;
  }
  
  logger.log(logger.yellow('Applying custom overrides from config...'));
  
  try {
    await config.applyOverrides(page);
    logger.log(`  ${logger.green('✓')} Custom overrides applied successfully`);
  } catch (e) {
    const error = e as Error;
    logger.log(`  ${logger.red('✗')} Override failed: ${error.message}`);
  }
}

/**
 * Run a single Lighthouse measurement
 */
async function runSingleMeasurement(
  browser: Browser,
  url: string,
  runNumber: number,
  totalRuns: number
): Promise<MeasurementResult> {
  logger.log(logger.cyan(`  Run ${runNumber}/${totalRuns}...`));
  
  const wsEndpoint = browser.wsEndpoint();
  const port = new URL(wsEndpoint).port;
  
  const { lhr } = await lighthouse(url, {
    port: parseInt(port, 10),
    output: 'json',
    onlyCategories: ['performance'],
    formFactor: 'desktop',
    screenEmulation: { disabled: true },
    throttling: {
      cpuSlowdownMultiplier: 1,
    },
  }) as { lhr: LighthouseResult };
  
  const metrics: MeasurementResult = {
    score: Math.round((lhr.categories.performance?.score || 0) * 100),
    fcp: lhr.audits['first-contentful-paint']?.numericValue || 0,
    lcp: lhr.audits['largest-contentful-paint']?.numericValue || 0,
    tbt: lhr.audits['total-blocking-time']?.numericValue || 0,
    cls: lhr.audits['cumulative-layout-shift']?.numericValue || 0,
    si: lhr.audits['speed-index']?.numericValue || 0,
  };
  
  logger.log(`    Score: ${metrics.score} | TBT: ${Math.round(metrics.tbt)}ms`);
  
  return metrics;
}

/**
 * Calculate average of an array of numbers
 */
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Run Lighthouse measurements with optional custom overrides
 */
export async function runMeasurements(
  options: MeasureOptions,
  config: WebperfConfig
): Promise<{
  metrics: MeasurementResult[];
  averages: MeasurementResult;
  minScore: number;
  maxScore: number;
}> {
  logger.boxHeader('Lighthouse Performance Measurement');
  logger.newline();
  
  logger.log(`${logger.cyan('Target URL:')} ${options.url}`);
  logger.log(`${logger.cyan('Number of runs:')} ${options.runs}`);
  if (options.note) logger.log(`${logger.cyan('Note:')} ${options.note}`);
  logger.log(`${logger.cyan('Apply Overrides:')} ${options.applyOverrides ? 'Yes' : 'No'}`);
  logger.newline();
  
  // Launch browser
  logger.log(logger.yellow('Launching Chrome...'));
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  
  try {
    // Apply custom overrides if enabled and config has override function
    if (options.applyOverrides && config.applyOverrides) {
      const page = await browser.newPage();
      await page.goto(options.url, { waitUntil: 'networkidle0', timeout: 60000 });
      await applyCustomOverrides(page, config);
      await page.close();
      logger.newline();
    } else if (options.applyOverrides && !config.applyOverrides) {
      logger.log(logger.yellow('Note: --applyOverrides requested but no applyOverrides function in config.'));
      logger.newline();
    }
    
    // Run lighthouse multiple times
    logger.log(logger.yellow('Running Lighthouse tests...'));
    logger.newline();
    
    const metrics: MeasurementResult[] = [];
    
    for (let i = 1; i <= options.runs; i++) {
      const result = await runSingleMeasurement(browser, options.url, i, options.runs);
      metrics.push(result);
      
      // Brief pause between runs
      if (i < options.runs) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    // Calculate averages
    const scores = metrics.map(m => m.score);
    const averages: MeasurementResult = {
      score: average(scores),
      fcp: average(metrics.map(m => m.fcp)),
      lcp: average(metrics.map(m => m.lcp)),
      tbt: average(metrics.map(m => m.tbt)),
      cls: average(metrics.map(m => m.cls)),
      si: average(metrics.map(m => m.si)),
    };
    
    return {
      metrics,
      averages,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
    };
  } finally {
    await browser.close();
  }
}

/**
 * Print measurement results to console
 */
export function printResults(
  averages: MeasurementResult,
  minScore: number,
  maxScore: number,
  runs: number,
  note?: string
): void {
  logger.newline();
  logger.header('PERFORMANCE RESULTS');
  logger.newline();
  
  logger.log(`  ${logger.bold('Metric'.padEnd(32))} ${logger.bold('Average'.padStart(12))} ${logger.bold('Unit'.padStart(12))}`);
  logger.separator();
  
  // Performance score with color
  const scoreStr = logger.scoreColor(Math.round(averages.score));
  logger.log(`  ${'Performance Score'.padEnd(32)} ${scoreStr.padStart(12)} ${'/100'.padStart(12)}`);
  
  logger.tableRow('First Contentful Paint (FCP)', Math.round(averages.fcp), 'ms');
  logger.tableRow('Largest Contentful Paint (LCP)', Math.round(averages.lcp), 'ms');
  logger.tableRow('Total Blocking Time (TBT)', Math.round(averages.tbt), 'ms');
  logger.tableRow('Cumulative Layout Shift (CLS)', averages.cls.toFixed(3), '');
  logger.tableRow('Speed Index', Math.round(averages.si), 'ms');
  
  logger.newline();
  logger.separator();
  logger.log(`  Score range: ${minScore} - ${maxScore} (across ${runs} runs)`);
  logger.newline();
  
  if (note) {
    logger.log(logger.magenta(`Note: ${note}`));
    logger.newline();
  }
  
  // Quick interpretation
  logger.log(logger.magenta('Quick Interpretation:'));
  
  if (averages.tbt > 600) {
    logger.log(logger.red('  ⚠ TBT > 600ms - Main thread is heavily blocked. Look for long tasks.'));
  } else if (averages.tbt > 200) {
    logger.log(logger.yellow('  ⚡ TBT 200-600ms - Some blocking. Room for improvement.'));
  } else {
    logger.log(logger.green('  ✓ TBT < 200ms - Good interactivity!'));
  }
  
  if (averages.lcp > 4000) {
    logger.log(logger.red('  ⚠ LCP > 4s - Largest paint is slow. Check images/fonts.'));
  } else if (averages.lcp > 2500) {
    logger.log(logger.yellow('  ⚡ LCP 2.5-4s - Needs improvement.'));
  } else {
    logger.log(logger.green('  ✓ LCP < 2.5s - Good perceived load speed!'));
  }
}
