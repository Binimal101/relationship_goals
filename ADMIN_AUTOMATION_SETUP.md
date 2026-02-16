# Admin Panel Login Automation

Automatically logs into the admin panel for development and manual testing.

## Quick Start

### 1. Install Dependencies

If you haven't already, install the required packages:

```bash
npm install
```

This will install `selenium-webdriver`, `js-yaml`, and other dependencies needed for the automation script.

### 2. Create Configuration File

Copy the example config and fill in your credentials:

```bash
cp example.config.yaml config.yaml
```

Edit `config.yaml` with your authentication details:

```yaml
email: your-email@example.com
password: your-password

securityAnswers:
  hisBirthday: "01/15/1990"      # MM/DD/YYYY format
  herBirthday: "03/22/1992"      # MM/DD/YYYY format
  anniversary: "06/10/2015"      # MM/DD/YYYY format
  firstPlace: "Central Park"     # Text answer
```

**⚠️ Important**: `config.yaml` is in `.gitignore` and won't be committed. Keep it safe and never share it.

### 3. Run the Automation

Start the automation script:

```bash
npm run dev:admin
```

This will:
- 🚀 Start the `npm run start` dev server
- ⏳ Wait for the server to be ready
- 🌐 Open a non-headless Chrome browser
- 🔐 Automatically log into the admin panel
- ✨ Leave the browser open for manual testing

### 4. Manual Testing

Once the browser opens and you're logged in:
- Use the admin panel for testing
- Close the browser window when done
- Press **Ctrl+C** in the terminal to shut down the dev server and automation

## Configuration

### config.yaml Options

```yaml
# Authentication credentials
email: your-email@example.com
password: your-password

# Security question answers (must match the auth form)
securityAnswers:
  hisBirthday: "01/15/1990"
  herBirthday: "03/22/1992"
  anniversary: "06/10/2015"
  firstPlace: "Central Park"

# Server configuration (optional)
server:
  port: 5173              # Dev server port (default: 5173)
  host: localhost         # Dev server host (default: localhost)
  timeout: 30000          # Timeout waiting for server (ms, default: 30000)

# Browser configuration (optional)
browser:
  headless: false         # Always false - use non-headless for manual testing
  implicit_wait: 10000    # Wait for elements (ms, default: 10000)
  page_load_timeout: 30000 # Page load timeout (ms, default: 30000)
```

## Features

### Authentication Caching

The script is smart about auth caching:

- ✅ If email/password form doesn't exist, it assumes you're already logged in
- ✅ If you see "Signed in as" text, the script skips login
- ✅ No need to re-login if Supabase session is cached in the browser
- ✅ Fully automated login if starting fresh

### Non-Headless Browser

- The browser window runs **visibly** (not headless)
- You can interact with it while the script runs
- Perfect for immediate manual testing after login
- Chrome browser remains open even after the script completes

### Error Handling

The script provides clear messages if:
- ❌ Config file is missing
- ❌ Server failed to start or didn't become ready
- ❌ Login failed or credentials were incorrect
- ❌ Missing security question answers

## Troubleshooting

### Chrome/Chromium not found

Ensure you have Chrome or Chromium installed. The script uses `chromedriver` to control the browser.

**Install Chrome:**
- macOS: `brew install google-chrome`
- Ubuntu/Debian: `sudo apt-get install google-chrome-stable`
- Windows: Download from https://www.google.com/chrome/

### Login fails

- Check your `config.yaml` credentials are correct
- Verify security question answers match your auth form
- Check console output for detailed error messages

### Security question answers not found

Make sure all required fields are in `config.yaml`:
- `hisBirthday`
- `herBirthday`
- `anniversary`
- `firstPlace`

The script will warn about missing answers but continue (in case some questions are optional).

### Port already in use

If port 5173 is already in use:
1. Kill the process using that port
2. Or specify a different port in `config.yaml`:
   ```yaml
   server:
     port: 5174
   ```

## How It Works

1. **Load Config**: Reads credentials from `config.yaml`
2. **Start Server**: Spawns `npm run start` process
3. **Health Check**: Polls the dev server until it's ready
4. **Open Browser**: Launches non-headless Chrome with Selenium
5. **Check Auth**: Detects if you're already logged in
6. **Login** (if needed):
   - Enters email and password
   - Fills in security question answers
   - Clicks "Unlock Our Memories" button
   - Waits for authentication to complete
7. **Ready**: Browser stays open for your manual testing
8. **Shutdown**: Press Ctrl+C to close everything

## Security Notes

- ⚠️ `config.yaml` contains your credentials - **never commit it to git**
- ⚠️ `.gitignore` is configured to exclude `config.yaml`
- ⚠️ Only use this script in development
- ⚠️ Make sure your `config.yaml` is in `.gitignore` before committing

## Development Only

This script is designed for **local development only**. It is not suitable for:
- Production environments
- CI/CD pipelines (use headless variant)
- Shared credential storage
- Automated test suites

For CI/CD automation, consider a headless variant or environment-based credential injection.
