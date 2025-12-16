/**
 * Generic service configuration for process management
 * Works with any dev server setup (not tied to any specific architecture)
 */
export interface Service {
  /** Unique identifier for this service */
  id: string;
  /** Working directory to run the command in */
  cwd: string;
  /** Command to start the service (e.g., "yarn start", "npm run dev") */
  command: string;
  /** Port the service runs on (used for health checks and cleanup) */
  port: number;
}

/**
 * Lighthouse measurement metrics
 * Uses abbreviated names internally, full names in JSON output for clarity
 */
export interface MeasurementResult {
  /** Performance score (0-100) */
  score: number;
  /** First Contentful Paint in ms */
  fcp: number;
  /** Largest Contentful Paint in ms */
  lcp: number;
  /** Total Blocking Time in ms */
  tbt: number;
  /** Cumulative Layout Shift */
  cls: number;
  /** Speed Index in ms */
  si: number;
}

/**
 * Full measurement session summary
 * Uses MeasurementResult directly for averages to avoid duplication
 */
export interface MeasurementSummary {
  url: string;
  runs: number;
  timestamp: string;
  /** Whether custom overrides were applied before measurement */
  overridesApplied: boolean;
  note?: string;
  /** Average metrics across all runs */
  averages: MeasurementResult;
  range: {
    minScore: number;
    maxScore: number;
  };
  rawScores: number[];
}

/**
 * Process information for a running service
 */
export interface ProcessInfo {
  name: string;
  port: number;
  pid?: number;
  running: boolean;
}

/**
 * Page interface for override functions (subset of Puppeteer's Page)
 * Only includes methods needed for applying overrides
 */
export interface PageForOverrides {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate: <T>(fn: (...args: any[]) => T, ...args: any[]) => Promise<T>;
}

/**
 * Configuration for the webperf tool
 * Generic design - works with any service architecture
 */
export interface WebperfConfig {
  /** Array of services to manage (start/stop/status) */
  services: Service[];
  
  /** Default URL for measurements */
  defaultUrl: string;
  
  /** Default number of measurement runs */
  defaultRuns: number;
  
  /**
   * Optional: Custom function to apply overrides before measurement
   * This is called with a Puppeteer page after navigating to the URL
   * Use this for any pre-measurement setup (e.g., feature flags, local overrides)
   */
  applyOverrides?: (page: PageForOverrides) => Promise<void>;
  
  /**
   * Optional: Returns a script string to print for manual override application
   * Users can copy-paste this into browser console
   */
  getOverrideScript?: () => string;
}

/**
 * CLI command options
 */
export interface MeasureOptions {
  url: string;
  runs: number;
  note?: string;
  applyOverrides: boolean;
}

export interface ServicesOptions {
  runs: number;
  note?: string;
  withOverrides: boolean;
}

/**
 * Comparison result between two measurement sessions
 */
export interface ComparisonResult {
  metric: string;
  before: number;
  after: number;
  diff: number;
  percentChange: number;
  improved: boolean;
}

/**
 * A single test scenario for batch measurements
 */
export interface TestScenario {
  /** Unique identifier/name for this scenario */
  id: string;
  /** Description/annotation for this test */
  note: string;
  /** URL to test */
  url: string;
  /** Number of runs (overrides default) */
  runs?: number;
  /** Whether to apply custom overrides for this scenario */
  applyOverrides?: boolean;
  /** Whether this scenario is enabled (default: true) */
  enabled?: boolean;
  /** Tags for categorizing and filtering scenarios */
  tags?: string[];
}

/**
 * Batch measurement result
 */
export interface BatchResult {
  /** When the batch started */
  batchId: string;
  /** ISO timestamp when batch started */
  startedAt: string;
  /** ISO timestamp when batch completed */
  completedAt: string;
  /** Tag filter(s) applied (if any) */
  tags?: string[];
  /** Total scenarios run */
  totalScenarios: number;
  /** Successful scenarios */
  completed: number;
  /** Failed scenarios */
  failed: number;
  /** Duration in ms */
  duration: number;
  /** Individual results */
  results: Array<{
    scenario: TestScenario;
    summary?: MeasurementSummary;
    error?: string;
    /** ISO timestamp when this scenario started */
    startedAt?: string;
    /** ISO timestamp when this scenario completed */
    completedAt?: string;
  }>;
}

/**
 * User settings (personal preferences, can be outside repo)
 */
export interface UserSettings {
  /** Path to external config file (absolute or relative to webperf dir) */
  configPath?: string;
  /** Default number of runs */
  defaultRuns?: number;
  /** Default URL to test */
  defaultUrl?: string;
  /** Custom path for results/logs (absolute or relative to webperf dir) */
  resultsPath?: string;
  /** Path for JSONL log file (all runs appended here) */
  jsonlLogPath?: string;
  /** Whether to auto-open results after measurement */
  autoOpenResults?: boolean;
  /** Default note prefix */
  notePrefix?: string;
  /** Pre-defined test scenarios for batch runs */
  scenarios?: TestScenario[];
  /** Max concurrent scenarios to run in parallel */
  maxConcurrency?: number;
}
