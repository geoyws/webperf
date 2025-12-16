/**
 * Webperf Configuration Example
 * 
 * ⚠️  DO NOT put your actual config in this repo!
 * 
 * This is a TEMPLATE. Copy it to your project directory:
 *   cp config.example.ts ~/projects/myapp/webperf.config.ts
 * 
 * Then point to it via environment variable:
 *   export WEBPERF_CONFIG_PATH=~/projects/myapp/webperf.config.ts
 * 
 * Or via settings.json:
 *   { "configPath": "/absolute/path/to/your/config.ts" }
 * 
 * This design prevents accidentally committing sensitive project data.
 */

import type { WebperfConfig } from './lib/types.js';

const config: WebperfConfig = {
  /**
   * Services to manage (start/stop/status)
   * Each service has an id, working directory, start command, and port
   */
  services: [
    {
      id: 'frontend',
      cwd: '/path/to/your/frontend',
      command: 'npm start',
      port: 3000,
    },
    // Add more services as needed:
    // {
    //   id: 'api',
    //   cwd: '/path/to/your/api',
    //   command: 'npm run dev',
    //   port: 4000,
    // },
  ],
  
  /**
   * Default URL for Lighthouse measurements
   * Can be overridden in settings.json
   */
  defaultUrl: 'http://localhost:3000',
  
  /**
   * Default number of Lighthouse runs
   * Can be overridden in settings.json
   */
  defaultRuns: 5,
  
  /**
   * Optional: Custom function to apply overrides before measurements
   * This is called after navigating to the URL, before running Lighthouse
   * Use for any pre-measurement setup (feature flags, local storage, etc.)
   */
  // applyOverrides: async (page) => {
  //   await page.evaluate(() => {
  //     // Example: Set a feature flag
  //     localStorage.setItem('my-feature-flag', 'true');
  //   });
  // },
  
  /**
   * Optional: Returns a script string to print for manual override application
   * Users can copy-paste this into browser console
   */
  // getOverrideScript: () => `
  //   // Paste this in browser console for manual setup
  //   localStorage.setItem('my-feature-flag', 'true');
  // `,
};

export default config;
