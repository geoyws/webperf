/**
 * Cross-platform colored console output
 * ANSI codes work on Windows 10+ terminals, macOS, and Linux
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
} as const;

type ColorName = keyof typeof colors;

/**
 * Check if stdout supports colors
 */
function supportsColor(): boolean {
  // Force color support check
  if (process.env.FORCE_COLOR !== undefined) {
    return process.env.FORCE_COLOR !== '0';
  }
  
  // Check for CI environments that support color
  if (process.env.CI) {
    return ['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'GITHUB_ACTIONS', 'BUILDKITE'].some(
      ci => process.env[ci]
    );
  }
  
  // Check if running in a TTY
  if (process.stdout.isTTY) {
    return true;
  }
  
  // Windows 10+ supports ANSI codes in cmd and PowerShell
  if (process.platform === 'win32') {
    const osRelease = require('os').release().split('.');
    return parseInt(osRelease[0], 10) >= 10;
  }
  
  return false;
}

const useColors = supportsColor();

/**
 * Wrap text in color codes
 */
function colorize(text: string, ...colorNames: ColorName[]): string {
  if (!useColors) return text;
  const colorCodes = colorNames.map(name => colors[name]).join('');
  return `${colorCodes}${text}${colors.reset}`;
}

/**
 * Logger utility for consistent console output
 */
export const logger = {
  // Basic colors
  red: (text: string) => colorize(text, 'red'),
  green: (text: string) => colorize(text, 'green'),
  yellow: (text: string) => colorize(text, 'yellow'),
  blue: (text: string) => colorize(text, 'blue'),
  cyan: (text: string) => colorize(text, 'cyan'),
  magenta: (text: string) => colorize(text, 'magenta'),
  gray: (text: string) => colorize(text, 'gray'),
  bold: (text: string) => colorize(text, 'bold'),
  dim: (text: string) => colorize(text, 'dim'),
  
  // Combined styles
  success: (text: string) => colorize(text, 'green'),
  error: (text: string) => colorize(text, 'red'),
  warn: (text: string) => colorize(text, 'yellow'),
  info: (text: string) => colorize(text, 'cyan'),
  
  // Log methods
  log: (...args: unknown[]) => console.log(...args),
  
  logSuccess: (message: string) => console.log(colorize(`✓ ${message}`, 'green')),
  logError: (message: string) => console.log(colorize(`✗ ${message}`, 'red')),
  logWarn: (message: string) => console.log(colorize(`⚠ ${message}`, 'yellow')),
  logInfo: (message: string) => console.log(colorize(`ℹ ${message}`, 'cyan')),
  
  // Section headers
  header: (title: string) => {
    const line = '═'.repeat(63);
    console.log(colorize(line, 'cyan'));
    console.log(colorize(`  ${title}`, 'bold'));
    console.log(colorize(line, 'cyan'));
  },
  
  // Box header (like the original scripts)
  boxHeader: (title: string) => {
    console.log(colorize(`
╔═══════════════════════════════════════════════════════════════╗
║  ${title.padEnd(60)}║
╚═══════════════════════════════════════════════════════════════╝`, 'cyan'));
  },
  
  // Table row
  tableRow: (label: string, value: string | number, unit = '') => {
    const labelStr = label.padEnd(32);
    const valueStr = String(value).padStart(12);
    const unitStr = unit.padStart(12);
    console.log(`  ${labelStr} ${valueStr} ${unitStr}`);
  },
  
  // Separator
  separator: () => {
    console.log('  ' + '─'.repeat(57));
  },
  
  // Empty line
  newline: () => console.log(''),
  
  // Score with color based on value
  scoreColor: (score: number): string => {
    if (score >= 90) return colorize(String(score), 'green');
    if (score >= 50) return colorize(String(score), 'yellow');
    return colorize(String(score), 'red');
  },
  
  // Diff with color based on whether improvement
  diffColor: (diff: number, lowerIsBetter: boolean): string => {
    const improved = lowerIsBetter ? diff < 0 : diff > 0;
    const sign = diff > 0 ? '+' : '';
    const text = `${sign}${diff.toFixed(0)}`;
    return improved ? colorize(text, 'green') : diff === 0 ? text : colorize(text, 'red');
  },
};

export default logger;

