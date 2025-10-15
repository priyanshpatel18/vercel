const { spawn, spawnSync } = require('child_process')
const { join } = require('path')
const { existsSync } = require('fs')

const APP_PATH = '/home/app/output'
const DIST_PATH = join(APP_PATH, 'dist')
const ENTRY_FILE = join(DIST_PATH, 'index.js')

// Step 1: Install dependencies
console.log('📦 Installing dependencies...')
const install = spawnSync('pnpm', ['install'], {
  cwd: APP_PATH,
  stdio: 'inherit'
})
if (install.status !== 0) {
  console.error('❌ pnpm install failed.')
  process.exit(install.status)
}

// Step 2: Build TypeScript
console.log('🏗️  Building TypeScript project...')
const build = spawnSync('pnpm', ['run', 'build'], {
  cwd: APP_PATH,
  stdio: 'inherit'
})
if (build.status !== 0) {
  console.error('❌ Build failed.')
  process.exit(build.status)
}

// Step 3: Verify build output
if (!existsSync(ENTRY_FILE)) {
  console.error(`❌ Expected entry file not found: ${ENTRY_FILE}`)
  process.exit(1)
}

console.log(`🚀 Starting Express app from ${ENTRY_FILE}...`)

// Step 4: Run the compiled Express app
const proc = spawn('node', [ENTRY_FILE], {
  cwd: APP_PATH,
  stdio: 'inherit',
  env: { ...process.env, PORT: 3000 }
})

proc.on('close', code => {
  console.log(`Express process exited with code ${code}`)
  process.exit(code)
})
