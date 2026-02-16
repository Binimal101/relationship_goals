# PRD: Admin Panel Login Automation Script

## Executive Summary

Create a developer-focused automation script that launches the npm dev server and automatically logs into the admin panel using Selenium, leaving a non-headless browser window open for manual testing. This eliminates repetitive manual login steps during development iterations.

---

## Problem Statement

- **Current Workflow**: Every time a developer restarts the dev server or testing session, they must manually wait for the app to load, navigate to settings, click admin panel, and enter credentials.
- **Pain Point**: Repetitive manual login for each test cycle wastes development time and creates friction for rapid testing iteration.
- **Use Case**: Developers frequently test admin panel changes and need a quick way to set up an authenticated session without manual interaction.

---

## Proposed Solution

Build a lightweight Node.js/npm script that:

1. Starts the `npm run start` dev server
2. Waits for the server to be ready and accessible
3. Opens a non-headless Chrome/Chromium browser via Selenium
4. Automatically logs into the admin panel (navigates, enters credentials)
5. Closes the automation and leaves the browser open for manual testing

The script runs locally and is intended for development only (non-production).

---

## Scope

### In Scope
- Script to launch npm dev server and wait for readiness
- Selenium WebDriver setup for non-headless browser automation
- Automatic navigation to login/admin panel authentication flow
- Credential handling (read from environment variables or config file)
- Error handling and logging for failed login attempts
- Browser remains open after automation completes

### Out of Scope
- Headless browser testing (intentionally non-headless)
- Automated functional tests after login
- CI/CD integration
- Production deployment of this script
- Multi-browser support (Chrome/Chromium only initially)
- Advanced test scenarios

---

## Technical Approach

### Architecture
```
admin-login-automation.js
├── Start npm run start process
├── Poll for server readiness (localhost:5173 or configured port)
├── Initialize Selenium WebDriver
├── Open non-headless browser
├── Execute login sequence
│   ├── Navigate to admin panel
│   ├── Enter authentication credentials
│   └── Wait for authentication to complete
├── Close automation (leave browser open)
└── Log success/failure and next steps
```

### Technology Stack
- **Node.js**: Script runner
- **Selenium WebDriver**: Browser automation (`selenium-webdriver` npm package)
- **Chromium/Chrome**: Browser driver
- **Environment variables**: Credential storage

### Prerequisites
- Chrome or Chromium browser installed
- `chromedriver` available in PATH or specified location
- Node.js 16+ with npm

---

## Implementation Details

### File Structure
```
scripts/
└── admin-login-automation.js
```

### Configuration
Create or reference a `.env` file:
```
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-admin-password
DEV_SERVER_PORT=5173
DEV_SERVER_TIMEOUT=30000  # Wait up to 30s for server to be ready
```

### Script Flow
1. **Server Startup**: Spawn `npm run start` as a child process
2. **Health Check**: Poll `http://localhost:PORT` until server responds with 200
3. **Browser Launch**: Initialize WebDriver with non-headless options
4. **Login Flow**:
   - Navigate to `http://localhost:PORT`
   - Locate and interact with login form/admin panel trigger
   - Enter credentials from env variables
   - Submit authentication
   - Wait for dashboard/admin panel to load
5. **Post-Login**:
   - Log success message
   - Print instructions for manual testing
   - Keep browser open (don't call `driver.quit()`)
   - Close WebDriver but leave browser process running

### Error Handling
- Server startup timeout → log error and exit
- Login element not found → log error and exit
- Authentication failure → log error and exit
- Credential missing from env → prompt or exit with clear message

### User Instructions
After running the script:
```
✓ Admin panel login automation complete!
✓ Browser is open and authenticated
→ You can now manually test admin features
→ Close the browser when done with testing
```

---

## Dependencies

Add to `package.json` (devDependencies):
```json
{
  "selenium-webdriver": "^4.x.x",
  "dotenv": "^16.x.x"
}
```

---

## Implementation Steps

1. Create `scripts/admin-login-automation.js`
2. Implement server startup and health check logic
3. Implement Selenium WebDriver initialization (non-headless)
4. Implement login flow (identify selectors, enter credentials, submit)
5. Add error handling and logging throughout
6. Create `.env.example` with required variables
7. Add npm script to `package.json`:
   ```json
   {
     "scripts": {
       "dev:admin": "node scripts/admin-login-automation.js"
     }
   }
   ```
8. Document usage in README

---

## Success Criteria

- ✅ Script successfully starts npm dev server
- ✅ Server readiness detection works reliably
- ✅ Non-headless browser opens and displays the app
- ✅ Login credentials are automatically entered and submitted
- ✅ Admin panel/dashboard loads after authentication
- ✅ Browser remains open after script completes
- ✅ Clear error messages on failure
- ✅ Developer can resume manual testing immediately
- ✅ Can be invoked via `npm run dev:admin`

---

## Notes

- **Security**: Credentials in `.env` are local development only; ensure `.env` is gitignored
- **Determinism**: Login flow selectors should be robust (use data-test attributes if possible)
- **Flexibility**: Script should allow custom timeouts and port configuration
- **Debugging**: Verbose logging option for troubleshooting
- **Browser State**: Consider clearing browser cache/cookies between runs if needed (optional)

---

## Future Enhancements (Post-MVP)

- Headless variant for CI/CD integration
- Support for multiple authentication methods
- Screenshot capture on failure
- Browser profile persistence
- Environment-specific configs (dev, staging, etc.)
- Wait for specific UI elements before considering "ready"
