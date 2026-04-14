import { execSync } from 'node:child_process';

console.log('\n🧹 Tearing down platform services...');

const run = (cmd: string, ignoreErrors = true) => {
  try {
    execSync(cmd, { stdio: 'ignore' });
  } catch (e) {
    if (!ignoreErrors) throw e;
  }
};

// 1. Teardown Azurite Docker Compose
console.log('📦 Stopping Azurite...');
run('docker compose -f docker/azurite/docker-compose.yml down');

// 2. Kill any stray worker Docker containers
console.log('🐳 Stopping Worker Containers...');
try {
  const containerIds = execSync('docker ps -q --filter ancestor=browser-orchestrator').toString().trim();
  if (containerIds) {
    const ids = containerIds.split('\n').join(' ');
    run(`docker rm -f ${ids}`);
  }
} catch (e) {
  // Ignore
}

// 3. Surgically kill lingering Node/Foreman processes
console.log('🔪 Killing lingering background processes...');
const processesToKill = [
  'nf start',
  'func start',
  'dist/index.js'
];

for (const p of processesToKill) {
  run(`pkill -f "${p}" || true`);
}

console.log('✨ Teardown complete!\n');
