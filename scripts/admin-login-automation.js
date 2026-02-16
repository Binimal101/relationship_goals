#!/usr/bin/env node

/**
 * Admin Panel Login Automation Script
 *
 * Automatically logs into the admin panel for manual testing.
 * - Starts `npm run start` dev server
 * - Waits for server readiness
 * - Opens non-headless browser
 * - Loads credentials from config.yaml
 * - Automatically authenticates if not already logged in
 * - Leaves browser open for manual testing
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { spawn } from 'child_process';
import http from 'http';
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG_PATH = path.join(__dirname, '..', 'config.yaml');
const DEFAULT_PORT = 5173;
const DEFAULT_HOST = 'localhost';
const DEFAULT_TIMEOUT = 30000;

// Load configuration
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ Config file not found: ${CONFIG_PATH}`);
    console.error(`📋 Please copy example.config.yaml to config.yaml and fill in your credentials.`);
    process.exit(1);
  }

  try {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = yaml.load(configContent);
    return config;
  } catch (error) {
    console.error(`❌ Failed to parse config.yaml: ${error.message}`);
    process.exit(1);
  }
}

// Wait for server to be ready
async function waitForServer(host, port, timeout = DEFAULT_TIMEOUT) {
  const startTime = Date.now();
  const url = `http://${host}:${port}`;

  while (Date.now() - startTime < timeout) {
    try {
      await new Promise((resolve, reject) => {
        http.get(url, { timeout: 5000 }, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 500) {
            resolve();
          } else {
            reject(new Error(`Status ${res.statusCode}`));
          }
        }).on('error', reject);
      });

      console.log(`✓ Server is ready at ${url}`);
      return url;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      process.stdout.write(
        `⏳ Waiting for server (${elapsed}ms)...\r`
      );
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error(`Server did not become ready within ${timeout}ms`);
}

// Check if already authenticated (presence of "Signed in as")
async function isAlreadyAuthenticated(driver) {
  try {
    // Look for the "Signed in as" text which indicates authenticated state
    const signedInElements = await driver.findElements(By.xpath("//*[contains(text(), 'Signed in as')]") );
    if (signedInElements.length > 0) {
      console.log('✓ Already authenticated (cached session detected)');
      return true;
    }

    return false;
  } catch (error) {
    console.log('⚠ Could not determine auth state:', error.message);
    return false;
  }
}

// Ensure the auth panel is visible by clicking the app's Settings/Admin button
async function ensureAuthPanelOpen(driver, timeout = 5000) {
  try {
    // Prefer a stable test-id on the admin button (added in App.tsx)
    const adminButtons = await driver.findElements(By.css("button[data-testid='open-admin']"));
    if (adminButtons.length > 0) {
      await adminButtons[0].click();

      // wait for either the email input or the "Signed in as" indicator
      await driver.wait(async () => {
        const signed = await driver.findElements(By.xpath("//*[contains(text(), 'Signed in as')]") );
        if (signed.length > 0) return true;
        const email = await driver.findElements(By.xpath("//input[@placeholder='you@domain.com']"));
        return email.length > 0;
      }, timeout).catch(() => {});

      return true;
    }

    console.warn('⚠ Admin open button not found — cannot open auth panel automatically');
    return false;
  } catch (err) {
    console.warn('⚠ Failed to open auth panel:', err.message);
    return false;
  }
}

// Perform login
async function performLogin(driver, config) {
  const { email, password, securityAnswers, browser } = config;
  const implicitWait = (browser?.implicit_wait || 10000);

  try {
    // Set implicit wait for finding elements
    await driver.manage().setTimeouts({ implicit: implicitWait });

    console.log('🔍 Opening auth panel and checking authentication status...');
    // Try to open the admin/auth panel first (click Settings button)
    await ensureAuthPanelOpen(driver);

    const isAuthenticated = await isAlreadyAuthenticated(driver);

    if (isAuthenticated) {
      console.log('✓ Skipping login - already authenticated (cached credentials)');
      // Wait a bit for admin panel to fully load
      await driver.sleep(2000);
      return;
    }

    console.log('🔐 Performing login...');

    // Enter email
    console.log('  • Entering email...');
    const emailInput = await driver.findElement(By.xpath("//input[@placeholder='you@domain.com']"));
    await emailInput.clear();
    await emailInput.sendKeys(email);

    // Enter password
    console.log('  • Entering password...');
    const passwordInput = await driver.findElement(By.xpath("//input[@type='password']"));
    await passwordInput.clear();
    await passwordInput.sendKeys(password);

    // Click the Sign in button and wait for the security question inputs to appear
    console.log('  • Clicking Sign in...');
    let clickedSignIn = false;

    // try data-testid first, then fallback to button text
    const signInByTest = await driver.findElements(By.css("button[data-testid='auth-sign-in']"));
    if (signInByTest.length > 0) {
      await signInByTest[0].click();
      clickedSignIn = true;
    } else {
      const signInByText = await driver.findElements(By.xpath("//button[normalize-space(.)='Sign in']"));
      if (signInByText.length > 0) {
        await signInByText[0].click();
        clickedSignIn = true;
      }
    }

    if (clickedSignIn) {
      // wait for the security inputs to render (or for signed-in state)
      await driver.wait(async () => {
        const signed = await driver.findElements(By.xpath("//*[contains(text(), 'Signed in as')]") );
        if (signed.length > 0) return true;
        const q = await driver.findElements(By.id('hisBirthday'));
        return q.length > 0;
      }, implicitWait).catch(() => {});
    } else {
      // if we couldn't click sign-in, wait briefly for security inputs anyway
      console.warn('  ⚠ Could not click Sign in — will wait for security inputs to appear (if already signed-in)');
      await driver.wait(async () => {
        const q = await driver.findElements(By.id('hisBirthday'));
        return q.length > 0;
      }, 3000).catch(() => {});
    }

    // Ensure security inputs are present before attempting to fill them
    const firstQuestion = await driver.findElements(By.id('hisBirthday'));
    if (firstQuestion.length === 0) {
      console.warn('  ⚠ Security question inputs not present — aborting credential entry to avoid mis-targeted input.');
      return;
    }

    // Enter security answers (use input IDs that match config keys)
    console.log('  • Entering security answers...');
    const questionIds = ['hisBirthday', 'herBirthday', 'anniversary', 'firstPlace'];

    for (const questionId of questionIds) {
      const answer = securityAnswers?.[questionId];
      if (!answer) {
        console.warn(`    ⚠ Missing answer for ${questionId}`);
        continue;
      }

      try {
        // prefer direct id lookup (we add corresponding ids in the app)
        const inputElement = await driver.findElements(By.id(questionId));
        if (inputElement.length > 0) {
          await inputElement[0].clear();
          await inputElement[0].sendKeys(answer);
          console.log(`    ✓ ${questionId}: ${answer}`);
          continue;
        }

        // fallbacks for older versions
        if (questionId === 'firstPlace') {
          const textInputs = await driver.findElements(By.xpath("//input[@placeholder='Enter the place...']"));
          if (textInputs.length > 0) {
            await textInputs[0].clear();
            await textInputs[0].sendKeys(answer);
            console.log(`    ✓ ${questionId}: ${answer} (fallback)`);
            continue;
          }
        } else {
          const dateInputsList = await driver.findElements(By.xpath("//input[@placeholder='MM/DD/YYYY']"));
          if (dateInputsList.length > 0) {
            const idx = questionIds.indexOf(questionId);
            const el = dateInputsList[idx] || dateInputsList[0];
            await el.clear();
            await el.sendKeys(answer);
            console.log(`    ✓ ${questionId}: ${answer} (fallback)`);
            continue;
          }
        }

        console.warn(`    ⚠ Could not find input for ${questionId}`);
      } catch (error) {
        console.warn(`    ⚠ Error entering ${questionId}: ${error.message}`);
      }
    }

    // Click submit button
    console.log('  • Submitting authentication...');
    const submitButton = await driver.findElement(
      By.xpath("//button[contains(., 'Unlock Our Memories')]")
    );

    // ensure visible / enabled and scroll into view (handles animations/overlays)
    await driver.wait(until.elementIsVisible(submitButton), 5000).catch(() => {});
    await driver.wait(until.elementIsEnabled(submitButton), 5000).catch(() => {});
    await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", submitButton);
    await driver.sleep(250);

    try {
      await submitButton.click();
    } catch (err) {
      // fallback to JS click when Selenium reports click intercepted
      console.warn('⚠ submit click intercepted — falling back to JS click:', err.message);
      await driver.executeScript("arguments[0].click();", submitButton);
    }

    // Wait for authentication to complete (look for the "Signed in as" indicator)
    console.log('  • Waiting for authentication...');
    await driver.wait(async () => {
      const signed = await driver.findElements(By.xpath("//*[contains(text(), 'Signed in as')]") );
      return signed.length > 0;
    }, 15000).catch(() => {});

    // final check
    const finalSigned = await driver.findElements(By.xpath("//*[contains(text(), 'Signed in as')]") );
    if (finalSigned.length > 0) {
      console.log('✓ Login successful!');
    } else {
      throw new Error('Waiting for authentication to complete');
    }
  } catch (error) {
    console.error(`❌ Login failed: ${error.message}`);
    throw error;
  }
}

// Main execution
async function main() {
  let serverProcess = null;
  let driver = null;

  try {
    // Load configuration
    console.log('📋 Loading configuration...');
    const config = loadConfig();
    const port = config.server?.port || DEFAULT_PORT;
    const host = config.server?.host || DEFAULT_HOST;
    const timeout = config.server?.timeout || DEFAULT_TIMEOUT;

    // Start npm run start
    console.log('\n🚀 Starting npm dev server...');
    serverProcess = spawn('npm', ['run', 'start'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    });

    // Wait for server to be ready
    console.log('⏳ Waiting for server to be ready...');
    const serverUrl = await waitForServer(host, port, timeout);

    // Initialize WebDriver
    console.log('\n🌐 Initializing browser...');
    const chromeOptions = new chrome.Options();
    // Don't use headless - we want non-headless for manual testing
    chromeOptions.addArguments('--disable-blink-features=AutomationControlled');
    chromeOptions.addArguments('--start-maximized');

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    console.log('✓ Browser opened');

    // Navigate to app
    console.log('\n📍 Navigating to app...');
    await driver.get(serverUrl);
    console.log(`✓ Navigated to ${serverUrl}`);

    // Perform login
    console.log('\n🔑 Authenticating...');
    await performLogin(driver, config);

    // Success message
    console.log('\n✨ All done!');
    console.log('\n📝 Next steps:');
    console.log('  • Browser is open and authenticated');
    console.log('  • You can now manually test admin features');
    console.log('  • Close the browser when done');
    console.log('\n💡 The npm dev server and Selenium session are still running.');
    console.log('   Press Ctrl+C to shut everything down.\n');

    // Keep the process alive
    await new Promise(() => {
      // This will never resolve, keeping the process alive
    });
  } catch (error) {
    console.error('\n❌ Automation failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup is handled by Ctrl+C
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down...');
      if (driver) {
        try {
          // Close the WebDriver session but leave the browser window open
          // User can manually close it
          await driver.quit();
        } catch (error) {
          console.log('Browser already closed');
        }
      }
      if (serverProcess) {
        serverProcess.kill();
      }
      process.exit(0);
    });
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
