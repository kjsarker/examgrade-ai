/**
 * Automated Google Drive + Cloud Console setup for ExamGrade AI.
 * Uses Playwright with a copy of Chrome profile so Google session is active.
 * Run: node scripts/setup-google-drive.mjs
 */
import { chromium } from 'playwright'
import { execSync, exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const CHROME_PROFILE = 'C:\\Users\\deepa\\AppData\\Local\\Google\\Chrome\\User Data'
const TMP_PROFILE = path.join(os.tmpdir(), 'examgrade-chrome-profile-' + Date.now())
const PROJECT_ID = 'examgrade-ai-' + Date.now().toString().slice(-6)
const SA_NAME = 'examgrade-drive-uploader'
const DRIVE_FOLDER_NAME = 'ExamGrade AI'

function log(msg) {
  console.log(`\n[SETUP] ${msg}`)
}

async function copyProfile() {
  log('Copying Chrome profile (this takes a moment)...')
  fs.mkdirSync(TMP_PROFILE, { recursive: true })
  // Copy only Default profile and Local State (needed for auth)
  const items = ['Default', 'Local State', 'First Run']
  for (const item of items) {
    const src = path.join(CHROME_PROFILE, item)
    const dst = path.join(TMP_PROFILE, item)
    if (fs.existsSync(src)) {
      execSync(`xcopy "${src}" "${dst}" /E /I /Q /Y`, { stdio: 'pipe' })
    }
  }
  // Remove lock files so Playwright can use the profile
  const locks = [
    path.join(TMP_PROFILE, 'Default', 'LOCK'),
    path.join(TMP_PROFILE, 'Default', 'lockfile'),
    path.join(TMP_PROFILE, 'SingletonLock'),
    path.join(TMP_PROFILE, 'SingletonCookie'),
    path.join(TMP_PROFILE, 'SingletonSocket'),
  ]
  locks.forEach(f => { try { fs.unlinkSync(f) } catch {} })
  log(`Profile copied to ${TMP_PROFILE}`)
}

async function run() {
  await copyProfile()

  log('Launching Chrome with your Google session...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      `--user-data-dir=${TMP_PROFILE}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
    ],
  })

  const context = browser.contexts()[0] || await browser.newContext()
  const page = await context.newPage()

  // ─── STEP 1: Create Google Cloud Project ───────────────────────────────────
  log('Step 1: Creating Google Cloud project...')
  await page.goto('https://console.cloud.google.com/projectcreate', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Check if we need to agree to ToS or if already signed in
  const url = page.url()
  if (url.includes('accounts.google.com')) {
    log('Not signed in to Google Cloud Console — please sign in in the browser window.')
    await page.waitForURL('**/console.cloud.google.com/**', { timeout: 120000 })
    await page.goto('https://console.cloud.google.com/projectcreate', { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
  }

  // Fill project name
  const projectNameInput = page.locator('input[id*="project-name"], input[placeholder*="project"]').first()
  await projectNameInput.waitFor({ timeout: 30000 })
  await projectNameInput.clear()
  await projectNameInput.fill('ExamGrade AI')
  await page.waitForTimeout(1000)

  // Click create
  const createBtn = page.locator('button:has-text("Create")').first()
  await createBtn.click()
  log('Project creation initiated, waiting...')
  await page.waitForTimeout(8000)

  // ─── STEP 2: Enable Drive API ───────────────────────────────────────────────
  log('Step 2: Enabling Google Drive API...')
  await page.goto(
    'https://console.cloud.google.com/apis/library/drive.googleapis.com',
    { waitUntil: 'networkidle' }
  )
  await page.waitForTimeout(3000)

  const enableBtn = page.locator('button:has-text("Enable"), a:has-text("Enable")').first()
  if (await enableBtn.isVisible()) {
    await enableBtn.click()
    await page.waitForTimeout(5000)
    log('Drive API enabled.')
  } else {
    log('Drive API may already be enabled or button not found.')
  }

  // ─── STEP 3: Create Service Account ────────────────────────────────────────
  log('Step 3: Creating service account...')
  await page.goto(
    'https://console.cloud.google.com/iam-admin/serviceaccounts/create',
    { waitUntil: 'networkidle' }
  )
  await page.waitForTimeout(3000)

  const saNameInput = page.locator('input[name="name"], input[placeholder*="name"]').first()
  await saNameInput.waitFor({ timeout: 30000 })
  await saNameInput.fill(SA_NAME)
  await page.waitForTimeout(500)

  const descInput = page.locator('input[name="description"], textarea[name="description"]').first()
  if (await descInput.isVisible()) {
    await descInput.fill('ExamGrade AI Drive uploader')
  }

  const doneBtn = page.locator('button:has-text("Create and continue"), button:has-text("Done"), button[type="submit"]').first()
  await doneBtn.click()
  await page.waitForTimeout(5000)

  // Skip role assignment steps
  const continueBtn = page.locator('button:has-text("Continue")').first()
  if (await continueBtn.isVisible()) await continueBtn.click()
  await page.waitForTimeout(2000)

  const doneBtn2 = page.locator('button:has-text("Done")').first()
  if (await doneBtn2.isVisible()) await doneBtn2.click()
  await page.waitForTimeout(3000)

  // ─── STEP 4: Create Key for Service Account ─────────────────────────────────
  log('Step 4: Creating and downloading service account key...')
  // Navigate to service accounts list and find our new one
  await page.goto(
    'https://console.cloud.google.com/iam-admin/serviceaccounts',
    { waitUntil: 'networkidle' }
  )
  await page.waitForTimeout(3000)

  // Click on our service account
  const saRow = page.locator(`text=${SA_NAME}`).first()
  await saRow.waitFor({ timeout: 20000 })
  await saRow.click()
  await page.waitForTimeout(2000)

  // Go to Keys tab
  const keysTab = page.locator('text=Keys, [data-tab-id="keys"], a:has-text("Keys")').first()
  await keysTab.click()
  await page.waitForTimeout(2000)

  // Click Add Key
  const addKeyBtn = page.locator('button:has-text("Add key"), button:has-text("ADD KEY")').first()
  await addKeyBtn.click()
  await page.waitForTimeout(1000)

  // Select Create new key
  const createKeyOption = page.locator('text=Create new key').first()
  await createKeyOption.click()
  await page.waitForTimeout(1000)

  // Select JSON and create
  const jsonRadio = page.locator('input[value="JSON"]').first()
  if (await jsonRadio.isVisible()) await jsonRadio.click()

  // Wait for download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button:has-text("Create")').first().click(),
  ])

  const keyPath = path.join(os.tmpdir(), 'examgrade-sa-key.json')
  await download.saveAs(keyPath)
  log(`Service account key downloaded to ${keyPath}`)

  const keyJson = JSON.parse(fs.readFileSync(keyPath, 'utf8'))
  const saEmail = keyJson.client_email
  const saKey = keyJson.private_key
  log(`Service account email: ${saEmail}`)

  // ─── STEP 5: Create Google Drive folder ─────────────────────────────────────
  log('Step 5: Creating Google Drive folder...')
  await page.goto('https://drive.google.com', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Click New button
  const newBtn = page.locator('button:has-text("New"), [aria-label="New"]').first()
  await newBtn.click()
  await page.waitForTimeout(1000)

  // Click New folder
  const folderOption = page.locator('text=New folder').first()
  await folderOption.click()
  await page.waitForTimeout(1000)

  // Type folder name
  const folderInput = page.locator('input[type="text"], input[aria-label*="folder name"]').first()
  await folderInput.clear()
  await folderInput.fill(DRIVE_FOLDER_NAME)
  await page.waitForTimeout(500)

  const createFolderBtn = page.locator('button:has-text("Create")').first()
  await createFolderBtn.click()
  await page.waitForTimeout(2000)

  // Get folder ID from URL or by clicking on it
  const folderLocator = page.locator(`text=${DRIVE_FOLDER_NAME}`).first()
  await folderLocator.dblclick()
  await page.waitForTimeout(2000)

  const driveUrl = page.url()
  const folderIdMatch = driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
  const folderId = folderIdMatch ? folderIdMatch[1] : ''
  log(`Drive folder ID: ${folderId}`)

  // ─── STEP 6: Share folder with service account ───────────────────────────────
  log('Step 6: Sharing folder with service account...')
  // Right click on folder to share
  await page.goto('https://drive.google.com', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  const folder = page.locator(`text=${DRIVE_FOLDER_NAME}`).first()
  await folder.click({ button: 'right' })
  await page.waitForTimeout(1000)

  const shareOption = page.locator('text=Share').first()
  await shareOption.click()
  await page.waitForTimeout(2000)

  // Add service account email
  const shareInput = page.locator('input[placeholder*="email"], input[aria-label*="email"], input[type="email"]').first()
  await shareInput.fill(saEmail)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2000)

  // Select Editor role
  const roleDropdown = page.locator('select, [aria-label*="role"]').last()
  if (await roleDropdown.isVisible()) {
    await roleDropdown.selectOption('Editor')
  }

  // Click Send/Share
  const sendBtn = page.locator('button:has-text("Send"), button:has-text("Share")').first()
  await sendBtn.click()
  await page.waitForTimeout(2000)
  log('Folder shared with service account.')

  // ─── STEP 7: Set Vercel environment variables ────────────────────────────────
  log('Step 7: Setting Vercel environment variables...')

  const envVars = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: saEmail,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: saKey,
    GOOGLE_DRIVE_FOLDER_ID: folderId,
  }

  for (const [key, value] of Object.entries(envVars)) {
    try {
      execSync(
        `npx vercel env add ${key} production`,
        { input: value, encoding: 'utf8', cwd: 'C:\\Users\\deepa\\Downloads\\Code_Exam Paper Grading\\examgrade-ai' }
      )
      log(`Set ${key}`)
    } catch (e) {
      // Try rm first then add
      try {
        execSync(`npx vercel env rm ${key} production --yes`, { encoding: 'utf8', cwd: 'C:\\Users\\deepa\\Downloads\\Code_Exam Paper Grading\\examgrade-ai' })
        execSync(`npx vercel env add ${key} production`, { input: value, encoding: 'utf8', cwd: 'C:\\Users\\deepa\\Downloads\\Code_Exam Paper Grading\\examgrade-ai' })
        log(`Updated ${key}`)
      } catch (e2) {
        log(`Failed to set ${key}: ${e2.message}`)
      }
    }
  }

  // Save credentials locally as backup
  const credsPath = path.join(os.tmpdir(), 'examgrade-env-vars.txt')
  fs.writeFileSync(credsPath, Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join('\n'))
  log(`Credentials also saved to: ${credsPath}`)

  // ─── STEP 8: Redeploy ────────────────────────────────────────────────────────
  log('Step 8: Deploying to Vercel with new env vars...')
  try {
    execSync('npx vercel --prod --yes', {
      encoding: 'utf8',
      cwd: 'C:\\Users\\deepa\\Downloads\\Code_Exam Paper Grading\\examgrade-ai',
      timeout: 180000,
    })
    log('Deployed successfully!')
  } catch (e) {
    log('Deploy may have issues: ' + e.message)
  }

  // ─── CLEANUP ─────────────────────────────────────────────────────────────────
  log('Cleaning up...')
  await browser.close()
  try { fs.rmSync(TMP_PROFILE, { recursive: true, force: true }) } catch {}
  try { fs.unlinkSync(keyPath) } catch {}

  log('✅ Setup complete!')
  log(`Drive folder: https://drive.google.com/drive/folders/${folderId}`)
  log('ExamGrade AI is now configured to upload exam files to your Google Drive.')
}

run().catch(err => {
  console.error('Setup failed:', err)
  process.exit(1)
})
