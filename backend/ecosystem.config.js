module.exports = {
  apps: [{
    name: 'wa-gateway-md',
    script: 'index.js',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
