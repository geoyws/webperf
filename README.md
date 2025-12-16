# Webperf - Cross-Platform Web Performance Measurement

A TypeScript-based tool for measuring web performance using Lighthouse and Puppeteer. Works on Windows, macOS, and Linux.

> **🔒 Security by Design**: This tool is designed so that **sensitive project configuration is stored OUTSIDE this repository**. This prevents accidentally committing internal project names, ports, or paths.

## Features

- **Cross-platform** - Works on Windows, macOS, and Linux
- **Lighthouse integration** - Runs Lighthouse programmatically via Puppeteer
- **Generic service management** - Start/stop any dev services (not tied to any specific architecture)
- **Custom overrides** - Define your own pre-measurement setup via config
- **Batch measurements** - Run multiple test scenarios in parallel with configurable concurrency
- **Result tracking** - Save and compare measurement results over time
- **JSONL logging** - All measurements appended to a JSONL file for analysis
- **External config only** - Project config must be stored outside this repo
- **Measure-only mode** - Works without any config for simple URL measurements

## Requirements

- Node.js 18+
- pnpm (recommended) or npm

## Installation

```bash
cd .cursor/scripts/webperf
pnpm install
```

## Usage

### Basic Commands

```bash
# Run performance measurements on a URL
npx tsx perf.ts measure http://localhost:3000

# Run with more iterations and a note
npx tsx perf.ts measure http://localhost:3000 --runs 10 --note "baseline"

# Run all test scenarios from settings (batch mode)
npx tsx perf.ts batch

# Run only scenarios in a specific group
npx tsx perf.ts batch --tag production

# Run with higher concurrency (default: 1 sequential)
npx tsx perf.ts batch --concurrency 5

# Start all services from config
npx tsx perf.ts start

# Start services + run measurements with custom overrides
npx tsx perf.ts start-measure --runs 5 --note "with local changes"

# Stop all services
npx tsx perf.ts stop

# Check service status
npx tsx perf.ts status

# Print custom override script (if configured)
npx tsx perf.ts overrides

# List saved results
npx tsx perf.ts results

# Show last result
npx tsx perf.ts last

# Compare two results
npx tsx perf.ts compare 2024-01-15T10-30-00 2024-01-15T11-00-00
```

### Using pnpm scripts

```bash
pnpm perf measure https://example.com
pnpm start
pnpm start-measure
pnpm stop
pnpm status
pnpm settings
```

## Settings

Settings are personal preferences that can be stored locally or globally. Create a settings file to customize defaults:

```bash
# Create settings.json in the webperf directory
npx tsx perf.ts settings init

# Or create globally in your home directory
# ~/.webperf-settings.json
```

### Settings File Example

```json
{
  "configPath": "../webperf.config.ts",
  "defaultRuns": 5,
  "defaultUrl": "http://localhost:3000",
  "resultsPath": "./results",
  "jsonlLogPath": "./results/measurements.jsonl",
  "autoOpenResults": false,
  "notePrefix": "[my-project]"
}
```

### Settings Options

| Setting | Description | Default |
|---------|-------------|---------|
| `configPath` | Path to external config file | `null` |
| `defaultRuns` | Number of Lighthouse runs per measurement | `5` |
| `defaultUrl` | Default URL to test | `https://example.com` |
| `resultsPath` | Directory for JSON results | `./results` |
| `jsonlLogPath` | Path for JSONL log file | `./results/measurements.jsonl` |
| `autoOpenResults` | Auto-open results after measurement | `false` |
| `notePrefix` | Prefix added to all notes | `""` |
| `maxConcurrency` | Max parallel scenarios in batch mode | `1` (sequential) |
| `scenarios` | Array of test scenarios for batch runs | `[]` |

## Settings vs Config: Understanding the Difference

This tool has two types of configuration:

### 1. **Settings** (`settings.json`) - Personal Preferences
- Lives in the webperf directory (gitignored)
- Contains personal preferences like `defaultRuns`, `notePrefix`
- Contains test scenarios for batch runs
- Can point to external config via `configPath`

### 2. **Config** (`webperf.config.ts`) - Project-Specific Setup
- **Must live OUTSIDE the webperf directory** (security)
- Contains project-specific data: service definitions, start commands
- Required only for `start` and `start-measure` commands
- Not needed for simple URL measurements

```
┌──────────────────────────────────────────────────────────┐
│ webperf/                                                 │
│   ├── settings.json (gitignored)                         │
│   │   - defaultRuns: 5                                   │
│   │   - scenarios: [...]                                 │
│   │   - configPath: "/path/to/external/config.ts" ───┐   │
│   └── ...                                            │   │
└──────────────────────────────────────────────────────│───┘
                                                       │
                                                       ▼
┌──────────────────────────────────────────────────────────┐
│ /path/to/your-project/webperf.config.ts                  │
│   - services: [{ id: "app", port: 3000, ... }, ...]      │
│   - applyOverrides: async (page) => { ... }              │
│   - getOverrideScript: () => "..."                       │
└──────────────────────────────────────────────────────────┘
```

### Settings Lookup Order

1. `./settings.json` (in webperf directory)
2. `./.webperf-settings.json` (hidden, in webperf directory)
3. `~/.webperf-settings.json` (in user home directory)

## Batch Measurements

Run multiple test scenarios in parallel for comprehensive performance testing.

### Defining Scenarios

Add scenarios to your `settings.json`:

```json
{
  "maxConcurrency": 3,
  "scenarios": [
    {
      "id": "homepage",
      "note": "Homepage baseline",
      "url": "https://example.com",
      "runs": 5,
      "tags": ["production"]
    },
    {
      "id": "dashboard",
      "note": "Dashboard with auth",
      "url": "https://example.com/dashboard",
      "runs": 3,
      "tags": ["production"]
    },
    {
      "id": "local-dev",
      "note": "Local development server",
      "url": "http://localhost:3000",
      "runs": 5,
      "tags": ["development"],
      "applyOverrides": true
    },
    {
      "id": "wip-feature",
      "note": "Work in progress - skip for now",
      "url": "https://example.com/wip",
      "enabled": false
    }
  ]
}
```

### Scenario Options

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier for the scenario |
| `note` | Yes | Description/annotation saved with results |
| `url` | Yes | URL to test |
| `runs` | No | Override default runs for this scenario |
| `tags` | No | Tags for filtering (e.g., ["production", "critical"]) |
| `applyOverrides` | No | Whether to apply custom overrides (default: false) |
| `enabled` | No | Set to `false` to skip this scenario (default: true) |

### Running Batch Tests

```bash
# Run all enabled scenarios (sequential by default for accuracy)
pnpm perf batch

# Run only scenarios with specific tag(s)
pnpm perf batch --tag production
pnpm perf batch --tag production --tag critical

# Run a single scenario by ID
pnpm perf batch --scenario homepage

# Enable parallel execution (may affect measurement accuracy)
pnpm perf batch --concurrency 3
```

> **Note:** Batch runs default to sequential execution (concurrency=1) because parallel Lighthouse runs compete for CPU resources, which can skew performance measurements. Use `--concurrency` only when speed matters more than accuracy.

### Batch Results

Batch results are saved to:
- Individual scenario results in `results/<timestamp>/summary.json`
- Batch summary appended to `results/measurements.batch.jsonl`

Example batch JSONL entry:
```json
{
  "type": "batch",
  "batchId": "2024-01-15T10-30-00-000Z",
  "totalScenarios": 3,
  "completed": 3,
  "failed": 0,
  "duration": 45000,
  "results": [...]
}
```

## Quick Start

### Measure-only mode (no config needed)

```bash
cd webperf
pnpm install
pnpm perf measure https://google.com --runs 3
```

### With service management (requires external config)

```bash
# Set path to your config (stored OUTSIDE this repo)
export WEBPERF_CONFIG_PATH=/path/to/your/project/webperf.config.ts

pnpm perf start         # Start all services
pnpm perf start-measure # Start + measure with custom overrides
```

## Configuration

> **⚠️ Important**: Project configuration must be stored **OUTSIDE** this repository. This is by design to prevent accidentally committing sensitive project information.

### Option 1: Environment Variable (Recommended)

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export WEBPERF_CONFIG_PATH=/path/to/your/project/webperf.config.ts
```

### Option 2: Settings File

Create `settings.json` in the webperf directory:

```json
{
  "configPath": "/absolute/path/to/your/config.ts"
}
```

Note: `settings.json` is gitignored and won't be committed.

### Creating Your Config File

Create your config file **in your project directory** (not in webperf):

```typescript
// Example: ~/projects/my-app/webperf.config.ts
import type { WebperfConfig } from '/path/to/webperf/lib/types.js';

const config: WebperfConfig = {
  // Define your services
  services: [
    {
      id: 'frontend',
      cwd: '/path/to/frontend',
      command: 'npm start',
      port: 3000,
    },
    {
      id: 'api',
      cwd: '/path/to/api',
      command: 'npm run dev',
      port: 4000,
    },
  ],
  
  // Defaults
  defaultUrl: 'http://localhost:3000',
  defaultRuns: 5,
  
  // Optional: Custom override function called before measurements
  // Use this for any pre-measurement setup (feature flags, local overrides, etc.)
  applyOverrides: async (page) => {
    await page.evaluate(() => {
      // Your custom setup code here
      // e.g., localStorage.setItem('feature-flag', 'true');
    });
  },
  
  // Optional: Script to print for manual browser console use
  getOverrideScript: () => `
    // Paste this in browser console
    localStorage.setItem('feature-flag', 'true');
  `,
};

export default config;
```

### Config Reference

```typescript
interface WebperfConfig {
  // Array of services to manage
  services: Array<{
    id: string;      // Unique identifier
    cwd: string;     // Working directory
    command: string; // Start command
    port: number;    // Port for health checks
  }>;
  
  // Defaults
  defaultUrl: string;
  defaultRuns: number;
  
  // Optional: Pre-measurement setup
  applyOverrides?: (page: Page) => Promise<void>;
  
  // Optional: Manual override script
  getOverrideScript?: () => string;
}
```

## How It Works

### Performance Measurement

1. Launches headless Chrome via Puppeteer
2. Optionally applies custom overrides from config
3. Runs Lighthouse multiple times
4. Calculates averages and saves results

### Metrics Measured

- **Performance Score** - Overall Lighthouse score (0-100)
- **FCP** - First Contentful Paint
- **LCP** - Largest Contentful Paint
- **TBT** - Total Blocking Time
- **CLS** - Cumulative Layout Shift
- **SI** - Speed Index

### Process Management

Uses cross-platform npm packages:
- `find-process` - Check which processes are using ports
- `tree-kill` - Kill process trees on any platform

## Results

### JSON Results

Results are saved to `./results/<timestamp>/summary.json` (or your custom `resultsPath`):

```json
{
  "url": "https://example.com",
  "runs": 5,
  "timestamp": "2024-01-15T10-30-00",
  "overridesApplied": true,
  "note": "with optimizations",
  "averages": {
    "score": 85,
    "fcp": 1200,
    "lcp": 2100,
    "tbt": 150,
    "cls": 0.05,
    "si": 1800
  },
  "range": {
    "minScore": 82,
    "maxScore": 88
  },
  "rawScores": [85, 82, 88, 84, 86]
}
```

**Metrics:**
- `score` - Performance score (0-100)
- `fcp` - First Contentful Paint (ms)
- `lcp` - Largest Contentful Paint (ms)
- `tbt` - Total Blocking Time (ms)
- `cls` - Cumulative Layout Shift
- `si` - Speed Index (ms)

### JSONL Log

All measurements are also appended to a JSONL (JSON Lines) file for easy analysis and tracking over time. Default location: `./results/measurements.jsonl`

Each line is a complete JSON measurement record:

```jsonl
{"url":"https://example.com","runs":5,"timestamp":"2024-01-15T10-30-00","averages":{...}}
{"url":"https://example.com","runs":5,"timestamp":"2024-01-15T11-00-00","averages":{...}}
```

This format is ideal for:
- Importing into data analysis tools
- Streaming processing
- Tracking performance trends over time
- Parsing with tools like `jq`

Example: Get all performance scores over time:
```bash
cat results/measurements.jsonl | jq -r '[.timestamp, .averages.performanceScore] | @tsv'
```

## Testing

Run tests with coverage:

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

Coverage reports are generated in `./coverage/` directory.

## Troubleshooting

### Chrome fails to launch

Make sure Chrome/Chromium is installed. Puppeteer will try to download it automatically, but on some systems you may need to install it manually.

### Ports still in use after stop

The tool tries to kill processes on configured ports. If issues persist:

```bash
# macOS/Linux
lsof -i :3000 | grep LISTEN
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Custom overrides not working

If your `applyOverrides` function isn't being called:
1. Make sure you're using `start-measure` command (not just `measure`)
2. Check that your config file exports the function correctly
3. Verify the page has loaded before overrides are applied

## License

MIT
