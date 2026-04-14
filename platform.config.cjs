module.exports = {
  apps: [
    {
      name: 'ingress-api',
      script: 'npx',
      args: 'func start',
      cwd: 'services/ingress-api',
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'browser-orchestrator',
      script: 'node',
      args: 'dist/index.js',
      cwd: 'services/browser-orchestrator',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
