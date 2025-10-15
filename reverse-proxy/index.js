const express = require('express');
const httpProxy = require('http-proxy');
const Redis = require('ioredis');

const PROXY_PORT = 8000;
const redis = new Redis({ host: '127.0.0.1', port: 6379 });
const proxy = httpProxy.createProxyServer({ changeOrigin: true });

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  res.status(502).send('Bad Gateway');
});

const app = express();

app.use(async (req, res) => {
  const subdomain = req.hostname.split('.')[0];

  // Get target port from Redis
  const port = await redis.get(`project:${subdomain}`);
  if (!port) return res.status(404).send('Unknown subdomain');

  proxy.web(req, res, { target: `http://localhost:${port}` });
});

app.listen(PROXY_PORT, () => console.log(`Reverse Proxy running on port ${PROXY_PORT}`));
