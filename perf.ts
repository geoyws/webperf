#!/usr/bin/env npx tsx
/**
 * Webperf CLI - Cross-platform web performance measurement tool
 * 
 * Usage:
 *   npx tsx perf.ts measure [url] [--runs N] [--note "text"]
 *   npx tsx perf.ts batch [--tag name]        # Run all scenarios from settings
 *   npx tsx perf.ts start                     # Start all services from config
 *   npx tsx perf.ts start-measure [--runs N]  # Start services + measure with overrides
 *   npx tsx perf.ts stop                      # Stop all services
 *   npx tsx perf.ts status                    # Check service status
 *   npx tsx perf.ts results                   # List saved results
 *   npx tsx perf.ts compare <file1> <file2>
 */

import type { BatchResult, MeasureOptions, MeasurementSummary, TestScenario, WebperfConfig } from './lib/types.js';
import { compareResults, listLogFiles, listResults, saveResults, showLastResult } from './lib/results.js';
import { createDefaultSettings, getConfigPath, loadSettings, printSettings } from './lib/settings.js';
import {
  ensurePortsFree,
  printOverrides,
  printStatus,
  startAllServices,
  stopAll,
  waitForPort,
  waitForServices,
} from './lib/process-manager.js';
import { printResults, runMeasurements } from './lib/lighthouse-runner.js';

import { existsSync } from 'fs';
import logger from './lib/logger.js';

/**
 * Load configuration from EXTERNAL sources only.
 * 
 * Config is loaded from (in order of priority):
 * 1. Environment variable WEBPERF_CONFIG_PATH
 * 2. configPath in settings.json (must point outside this repo)
 * 3. Default minimal config (measure-only mode, no services)
 * 
 * This design ensures sensitive project data is NEVER stored in this repo.
 */
async function loadConfig(): Promise<WebperfConfig> {
  const settings = loadSettings();
  
  // Check environment variable first
  const envConfigPath = process.env.WEBPERF_CONFIG_PATH;
  
  // Then check settings.json
  const settingsConfigPath = getConfigPath();
  
  // Use env var or settings path
  const externalConfigPath = envConfigPath || settingsConfigPath;
  
  // Default configuration - minimal, for measure-only mode
  // No project-specific data - just defaults for running Lighthouse on any URL
  const defaultConfig: WebperfConfig = {
    services: [],
    defaultUrl: settings.defaultUrl || 'https://example.com',
    defaultRuns: settings.defaultRuns || 5,
  };
  
  // Load external config if provided
  if (externalConfigPath) {
    if (!existsSync(externalConfigPath)) {
      logger.logError(`Config file not found: ${externalConfigPath}`);
      logger.log(logger.dim('  Set WEBPERF_CONFIG_PATH env var or configPath in settings.json'));
      logger.log(logger.dim('  Config must be stored OUTSIDE this repo'));
      process.exit(1);
    }
    
    try {
      const externalConfig = await import(externalConfigPath);
      logger.log(logger.dim(`Config loaded from: ${externalConfigPath}`));
      return { 
        ...defaultConfig, 
        ...externalConfig.default,
        defaultUrl: settings.defaultUrl || externalConfig.default.defaultUrl || defaultConfig.defaultUrl,
        defaultRuns: settings.defaultRuns || externalConfig.default.defaultRuns || defaultConfig.defaultRuns,
      };
    } catch (e) {
      const error = e as Error;
      logger.logError(`Failed to load config: ${error.message}`);
      process.exit(1);
    }
  }
  
  // No external config - measure-only mode
  logger.log(logger.dim('No external config - running in measure-only mode'));
  logger.log(logger.dim('  To use services, set WEBPERF_CONFIG_PATH or configPath in settings.json'));
  return defaultConfig;
}

/**
 * Parse CLI arguments
 */
function parseArgs(): {
  command: string;
  url?: string;
  runs: number;
  note?: string;
  file1?: string;
  file2?: string;
  settingsPath?: string;
  tags: string[];
  concurrency?: number;
  scenarioId?: string;
} {
  const args = process.argv.slice(2);
  const settings = loadSettings();
  const result: ReturnType<typeof parseArgs> = {
    command: args[0] || 'help',
    runs: settings.defaultRuns || 5,
    tags: [],
  };
  
  // Get command
  const command = args[0];
  
  // Parse remaining args
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--runs' || arg === '-r') {
      result.runs = parseInt(args[++i], 10) || 5;
    } else if (arg === '--note' || arg === '-n') {
      result.note = args[++i];
    } else if (arg === '--tag' || arg === '-t') {
      // Can be specified multiple times: --tag production --tag critical
      result.tags.push(args[++i]);
    } else if (arg === '--concurrency' || arg === '-c') {
      result.concurrency = parseInt(args[++i], 10) || 1;
    } else if (arg === '--scenario' || arg === '-s') {
      result.scenarioId = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      result.command = 'help';
    } else if (arg.startsWith('--')) {
      // Unknown flag, ignore
    } else {
      // Positional argument
      if (command === 'compare') {
        if (!result.file1) {
          result.file1 = arg;
        } else {
          result.file2 = arg;
        }
      } else if (command === 'measure' && !result.url) {
        result.url = arg;
      } else if (!result.url && arg.startsWith('http')) {
        result.url = arg;
      }
    }
  }
  
  return result;
}

/**
 * Print usage help
 */
function printHelp(): void {
  const settings = loadSettings();
  
  logger.boxHeader('Webperf - Performance Measurement Tool');
  logger.newline();
  
  logger.log(logger.yellow('Usage:'));
  logger.log('  npx tsx perf.ts <command> [options]');
  logger.newline();
  
  logger.log(logger.yellow('Commands:'));
  logger.log('  measure [url]         Run Lighthouse performance tests');
  logger.log('  batch                 Run all scenarios from settings in parallel');
  logger.log('  start                 Start all services from config');
  logger.log('  start-measure         Start services + measure with custom overrides');
  logger.log('  stop                  Stop all running services');
  logger.log('  status                Check service status');
  logger.log('  overrides             Print browser console override script (if configured)');
  logger.log('  results               List saved results');
  logger.log('  logs                  List log files by group/scenario');
  logger.log('  last                  Show last result');
  logger.log('  compare <f1> <f2>     Compare two result files');
  logger.log('  settings              Show current settings');
  logger.log('  settings init         Create a settings.json file');
  logger.log('  help                  Show this help');
  logger.newline();
  
  logger.log(logger.yellow('Options:'));
  logger.log(`  --runs, -r <n>        Number of test runs (default: ${settings.defaultRuns})`);
  logger.log('  --note, -n "text"     Add annotation to this run');
  logger.log('  --tag, -t "name"      Filter batch by tag (can use multiple times)');
  logger.log('  --scenario, -s "id"   Run only this scenario from batch');
  logger.log('  --concurrency, -c <n> Max parallel scenarios (default: 1 sequential)');
  logger.log('  --help, -h            Show help');
  logger.newline();
  
  logger.log(logger.yellow('Examples:'));
  logger.log('  npx tsx perf.ts measure https://example.com');
  logger.log('  npx tsx perf.ts measure --runs 10 --note "baseline"');
  logger.log('  npx tsx perf.ts batch --tag production');
  logger.log('  npx tsx perf.ts batch --tag production --tag critical');
  logger.log('  npx tsx perf.ts batch --concurrency 5');
  logger.log('  npx tsx perf.ts start-measure --runs 5 --note "with optimizations"');
  logger.log('  npx tsx perf.ts compare 2024-01-15T10-30-00 2024-01-15T11-00-00');
  logger.newline();
  
  logger.log(logger.yellow('Configuration:'));
  logger.log('  This tool requires EXTERNAL config for service management features.');
  logger.log('  Config must be stored OUTSIDE this repo to prevent accidental commits.');
  logger.log('');
  logger.log('  Option 1: Environment variable');
  logger.log('    export WEBPERF_CONFIG_PATH=/path/to/your/config.ts');
  logger.log('');
  logger.log('  Option 2: Settings file (settings.json)');
  logger.log('    npx tsx perf.ts settings init');
  logger.log('    Then edit settings.json to set configPath');
  logger.log('');
  logger.log('  The measure command works without config (just measures any URL).');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = parseArgs();
  const config = await loadConfig();
  
  switch (args.command) {
    case 'measure': {
      const settings = loadSettings();
      const url = args.url || config.defaultUrl;
      const notePrefix = settings.notePrefix || '';
      const fullNote = args.note 
        ? (notePrefix ? `${notePrefix} ${args.note}` : args.note)
        : undefined;
      
      const options: MeasureOptions = {
        url,
        runs: args.runs,
        note: fullNote,
        applyOverrides: false,
      };
      
      const { metrics, averages, minScore, maxScore } = await runMeasurements(options, config);
      
      printResults(averages, minScore, maxScore, args.runs, fullNote);
      
      saveResults({
        url,
        runs: args.runs,
        averages,
        minScore,
        maxScore,
        rawScores: metrics.map(m => m.score),
        overridesApplied: false,
        note: fullNote,
      });
      break;
    }
    
    case 'batch': {
      const settings = loadSettings();
      const scenarios = settings.scenarios || [];
      
      if (scenarios.length === 0) {
        logger.logError('No scenarios defined in settings.');
        logger.log('');
        logger.log('  Add scenarios to your settings.json:');
        logger.log('');
        logger.log('  {');
        logger.log('    "scenarios": [');
        logger.log('      {');
        logger.log('        "id": "homepage",');
        logger.log('        "note": "Homepage baseline",');
        logger.log('        "url": "https://example.com",');
        logger.log('        "runs": 5,');
        logger.log('        "tags": ["production"]');
        logger.log('      }');
        logger.log('    ]');
        logger.log('  }');
        process.exit(1);
      }
      
      // Filter scenarios
      let filteredScenarios = scenarios.filter(s => s.enabled !== false);
      
      // Filter by tags if provided (scenarios must have ALL specified tags)
      if (args.tags.length > 0) {
        filteredScenarios = filteredScenarios.filter(s => {
          if (!s.tags || s.tags.length === 0) return false;
          return args.tags.every(tag => s.tags!.includes(tag));
        });
        if (filteredScenarios.length === 0) {
          logger.logError(`No scenarios found with tags: ${args.tags.join(', ')}`);
          // Collect all unique tags from scenarios
          const allTags = new Set<string>();
          scenarios.forEach(s => s.tags?.forEach(t => allTags.add(t)));
          logger.log('  Available tags: ' + [...allTags].sort().join(', '));
          process.exit(1);
        }
      }
      
      if (args.scenarioId) {
        filteredScenarios = filteredScenarios.filter(s => s.id === args.scenarioId);
        if (filteredScenarios.length === 0) {
          logger.logError(`Scenario not found: ${args.scenarioId}`);
          logger.log('  Available scenarios: ' + scenarios.map(s => s.id).join(', '));
          process.exit(1);
        }
      }
      
      // Default to sequential execution (concurrency 1) for more accurate measurements
      // Parallel Lighthouse runs compete for CPU and can skew results
      const concurrency = args.concurrency || settings.maxConcurrency || 1;
      const batchId = new Date().toISOString().replace(/[:.]/g, '-');
      
      logger.boxHeader(`Batch Performance Test (${filteredScenarios.length} scenarios)`);
      logger.newline();
      logger.log(logger.dim(`  Batch ID: ${batchId}`));
      if (concurrency > 1) {
        logger.log(logger.dim(`  Concurrency: ${concurrency} (parallel - may affect accuracy)`));
      } else {
        logger.log(logger.dim(`  Mode: Sequential (recommended for accurate results)`));
      }
      logger.log(logger.dim(`  Scenarios: ${filteredScenarios.map(s => s.id).join(', ')}`));
      logger.newline();
      
      const startTime = Date.now();
      const startedAt = new Date().toISOString();
      const batchResult: BatchResult = {
        batchId,
        startedAt,
        completedAt: '', // Will be set after completion
        ...(args.tags.length > 0 && { tags: args.tags }),
        totalScenarios: filteredScenarios.length,
        completed: 0,
        failed: 0,
        duration: 0,
        results: [],
      };
      
      // Run scenarios with concurrency limit
      const runScenario = async (scenario: TestScenario): Promise<void> => {
        const scenarioStartedAt = new Date().toISOString();
        const scenarioRuns = scenario.runs || args.runs;
        const notePrefix = settings.notePrefix || '';
        const fullNote = scenario.note 
          ? (notePrefix ? `${notePrefix} ${scenario.note}` : scenario.note)
          : undefined;
        
        const options: MeasureOptions = {
          url: scenario.url,
          runs: scenarioRuns,
          note: fullNote,
          applyOverrides: scenario.applyOverrides || false,
        };
        
        try {
          const tagsLabel = scenario.tags && scenario.tags.length > 0 
            ? scenario.tags.join(', ') 
            : 'untagged';
          logger.log(logger.cyan(`Starting: ${scenario.id} [${tagsLabel}]`));
          
          const { metrics, averages, minScore, maxScore } = await runMeasurements(options, config);
          
          const scenarioCompletedAt = new Date().toISOString();
          
          const summary: MeasurementSummary = {
            url: scenario.url,
            runs: scenarioRuns,
            timestamp: scenarioCompletedAt,
            overridesApplied: scenario.applyOverrides || false,
            note: fullNote,
            averages,
            range: { minScore, maxScore },
            rawScores: metrics.map(m => m.score),
          };
          
          // Save results with tags and scenarioId for separate logging
          saveResults({
            url: scenario.url,
            runs: scenarioRuns,
            averages,
            minScore,
            maxScore,
            rawScores: metrics.map(m => m.score),
            overridesApplied: scenario.applyOverrides || false,
            note: fullNote,
            tags: scenario.tags,
            scenarioId: scenario.id,
          });
          
          batchResult.results.push({ 
            scenario, 
            summary,
            startedAt: scenarioStartedAt,
            completedAt: scenarioCompletedAt,
          });
          batchResult.completed++;
          
          logger.log(logger.green(`✓ Completed: ${scenario.id} - Score: ${averages.score.toFixed(0)}`));
        } catch (error) {
          const err = error as Error;
          batchResult.results.push({ 
            scenario, 
            error: err.message,
            startedAt: scenarioStartedAt,
            completedAt: new Date().toISOString(),
          });
          batchResult.failed++;
          logger.logError(`✗ Failed: ${scenario.id} - ${err.message}`);
        }
      };
      
      // Process scenarios
      if (concurrency === 1) {
        // Sequential execution (default) - most accurate results
        for (const scenario of filteredScenarios) {
          await runScenario(scenario);
        }
      } else {
        // Parallel execution with concurrency limit
        const queue = [...filteredScenarios];
        const running: Promise<void>[] = [];
        
        while (queue.length > 0 || running.length > 0) {
          while (running.length < concurrency && queue.length > 0) {
            const scenario = queue.shift()!;
            const promise = runScenario(scenario).then(() => {
              running.splice(running.indexOf(promise), 1);
            });
            running.push(promise);
          }
          if (running.length > 0) {
            await Promise.race(running);
          }
        }
      }
      
      batchResult.duration = Date.now() - startTime;
      batchResult.completedAt = new Date().toISOString();
      
      // Print batch summary
      logger.newline();
      logger.boxHeader('Batch Summary');
      logger.newline();
      logger.log(`  Total scenarios:  ${batchResult.totalScenarios}`);
      logger.log(`  Completed:        ${logger.green(String(batchResult.completed))}`);
      logger.log(`  Failed:           ${batchResult.failed > 0 ? logger.red(String(batchResult.failed)) : '0'}`);
      logger.log(`  Duration:         ${(batchResult.duration / 1000).toFixed(1)}s`);
      logger.newline();
      
      if (batchResult.results.length > 0) {
        logger.log(logger.yellow('Results:'));
        for (const result of batchResult.results) {
          if (result.summary) {
            const score = result.summary.averages.score;
            const scoreColor = score >= 90 ? logger.green : score >= 50 ? logger.yellow : logger.red;
            logger.log(`  ${result.scenario.id}: ${scoreColor(score.toFixed(0))} - ${result.scenario.note || ''}`);
          } else {
            logger.log(`  ${result.scenario.id}: ${logger.red('FAILED')} - ${result.error}`);
          }
        }
      }
      
      // Save batch summary to JSONL
      const { saveBatchResult } = await import('./lib/results.js');
      saveBatchResult(batchResult);
      
      break;
    }
    
    case 'start': {
      // Require external config for service commands
      if (config.services.length === 0) {
        logger.logError('No services configured.');
        logger.log('');
        logger.log('  Set up your config file outside this repo:');
        logger.log('    1. Create a config file (e.g., ~/projects/myapp/webperf.config.ts)');
        logger.log('    2. Set WEBPERF_CONFIG_PATH=/path/to/config.ts');
        logger.log('    3. Or set configPath in settings.json');
        logger.log('');
        logger.log('  See config.example.ts for the config format.');
        process.exit(1);
      }
      
      await ensurePortsFree(config);
      
      logger.boxHeader('Development Environment');
      logger.newline();
      
      // Start all services
      await startAllServices(config);
      
      // Print overrides if configured
      printOverrides(config);
      
      logger.newline();
      logger.log(logger.cyan('All services are starting. Press Ctrl+C to stop all.'));
      logger.newline();
      
      // Keep process running
      await new Promise(() => {});
      break;
    }
    
    case 'start-measure': {
      // Require external config for service commands
      if (config.services.length === 0) {
        logger.logError('No services configured.');
        logger.log('');
        logger.log('  For measure-only mode, use: npx tsx perf.ts measure <url>');
        logger.log('');
        logger.log('  To use service features, set up external config:');
        logger.log('    export WEBPERF_CONFIG_PATH=/path/to/your/config.ts');
        process.exit(1);
      }
      
      logger.boxHeader('Performance Test with Services');
      logger.newline();
      
      // Check if services are already running (check first service's port)
      const firstServicePort = config.services[0]?.port;
      const servicesReady = firstServicePort ? await waitForPort(firstServicePort, 1000) : false;
      
      if (!servicesReady) {
        // Need to start services
        await ensurePortsFree(config);
        
        logger.log(logger.cyan('Starting services...'));
        logger.newline();
        
        // Start all services
        await startAllServices(config);
        
        // Wait for all services to be ready
        const ready = await waitForServices(config);
        if (!ready) {
          logger.logError('Services failed to start');
          await stopAll(config);
          process.exit(1);
        }
        
        // Give services a moment to stabilize
        logger.log(logger.yellow('Waiting for services to stabilize...'));
        await new Promise(r => setTimeout(r, 5000));
      } else {
        logger.log(logger.green('Services already running'));
      }
      
      logger.newline();
      
      // Run measurements with overrides (if config has applyOverrides function)
      const settings = loadSettings();
      const url = args.url || config.defaultUrl;
      const notePrefix = settings.notePrefix || '';
      const fullNote = args.note 
        ? (notePrefix ? `${notePrefix} ${args.note}` : args.note)
        : undefined;
      
      const options: MeasureOptions = {
        url,
        runs: args.runs,
        note: fullNote,
        applyOverrides: true,
      };
      
      const { metrics, averages, minScore, maxScore } = await runMeasurements(options, config);
      
      printResults(averages, minScore, maxScore, args.runs, fullNote);
      
      saveResults({
        url,
        runs: args.runs,
        averages,
        minScore,
        maxScore,
        rawScores: metrics.map(m => m.score),
        overridesApplied: true,
        note: fullNote,
      });
      
      logger.newline();
      logger.log(logger.yellow('Services are still running. Stop with:'));
      logger.log('  npx tsx perf.ts stop');
      break;
    }
    
    case 'stop': {
      await stopAll(config);
      break;
    }
    
    case 'status': {
      await printStatus(config);
      break;
    }
    
    case 'overrides': {
      printOverrides(config);
      break;
    }
    
    case 'results': {
      listResults();
      break;
    }
    
    case 'logs': {
      listLogFiles();
      break;
    }
    
    case 'last': {
      showLastResult();
      break;
    }
    
    case 'compare': {
      if (!args.file1 || !args.file2) {
        logger.logError('Compare requires two file paths or timestamps');
        logger.log('  Usage: npx tsx perf.ts compare <file1> <file2>');
        process.exit(1);
      }
      compareResults(args.file1, args.file2);
      break;
    }
    
    case 'settings': {
      // Check for subcommand
      const subcommand = process.argv[3];
      if (subcommand === 'init') {
        createDefaultSettings(args.settingsPath);
      } else {
        printSettings();
      }
      break;
    }
    
    case 'help':
    default: {
      printHelp();
      break;
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.newline();
  logger.log(logger.yellow('Received SIGINT, stopping services...'));
  const config = await loadConfig();
  await stopAll(config);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  const config = await loadConfig();
  await stopAll(config);
  process.exit(0);
});

// Run
main().catch(err => {
  logger.logError(`Error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
