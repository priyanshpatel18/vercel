import "dotenv/config";
import { redis } from "./redis";
import { downloadBuild } from "./r2";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";

// Create GoDaddy A record for subdomain pointing to public IP
async function createSubdomain(subdomain: string) {
  const API_KEY = process.env.GODADDY_KEY!;
  const API_SECRET = process.env.GODADDY_SECRET!;
  const DOMAIN = process.env.GODADDY_DOMAIN!;
  const IP = process.env.PUBLIC_IP!;

  const url = `https://api.godaddy.com/v1/domains/${DOMAIN}/records/A/${subdomain}`;
  const body = [{ data: IP, ttl: 600 }];

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `sso-key ${API_KEY}:${API_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to create GoDaddy DNS for ${subdomain}.${DOMAIN}: ${text}`);
  } else {
    console.log(`✅ GoDaddy DNS created: ${subdomain}.${DOMAIN} → ${IP}`);
  }
}

// Deploy the build in Docker with nginx reverse proxy + HTTPS
async function deployPod(
  id: string,
  entryPoint = "index.js",
  env?: Record<string, string>,
  subdomain?: string
) {
  if (!subdomain) throw new Error("Subdomain is required for deployment");

  const tempDir = path.join("/tmp/docker", id);
  fs.mkdirSync(tempDir, { recursive: true });

  const containerName = `build-${id}`;
  const proxyName = `proxy-${id}`;
  const network = "deploy-net";

  // Ensure Docker network exists
  spawnSync("docker", ["network", "create", network], { stdio: "ignore" });

  // Stop old containers if running
  spawnSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
  spawnSync("docker", ["rm", "-f", proxyName], { stdio: "ignore" });

  // Prepare env variables
  const envArgs = env ? Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]) : [];

  // Run JS app container
  spawnSync("docker", [
    "run", "-d",
    "--name", containerName,
    "--network", network,
    "-v", `${tempDir}:/app`,
    ...envArgs,
    "node:18-alpine",
    "sh", "-c",
    `cd /app && node ${entryPoint}`
  ], { stdio: "inherit" });

  console.log(`➡️ Container ${containerName} running with entry ${entryPoint}`);

  // Create GoDaddy DNS
  await createSubdomain(subdomain);

  // Create nginx config
  const nginxDir = path.join(tempDir, "nginx");
  fs.mkdirSync(nginxDir, { recursive: true });
  const nginxConfig = `
server {
    listen 80;
    server_name ${subdomain}.${process.env.GODADDY_DOMAIN};

    location / {
        proxy_pass http://${containerName}:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
  `;
  fs.writeFileSync(path.join(nginxDir, "default.conf"), nginxConfig);

  // Run nginx container with linked network
  spawnSync("docker", [
    "run", "-d",
    "--name", proxyName,
    "--network", network,
    "-p", "80:80",
    "-p", "443:443",
    "-v", `${nginxDir}:/etc/nginx/conf.d`,
    "nginx:alpine"
  ], { stdio: "inherit" });

  console.log(`➡️ Nginx reverse proxy running for ${subdomain}.${process.env.GODADDY_DOMAIN}`);

  // Setup HTTPS using Certbot (automatic SSL)
  spawnSync("docker", [
    "run", "--rm",
    "--name", `certbot-${id}`,
    "--network", network,
    "-v", "/etc/letsencrypt:/etc/letsencrypt",
    "-v", "/var/lib/letsencrypt:/var/lib/letsencrypt",
    "certbot/certbot",
    "certonly", "--webroot",
    "-w", "/var/lib/letsencrypt",
    "-d", `${subdomain}.${process.env.GODADDY_DOMAIN}`,
    "--email", process.env.ADMIN_EMAIL!,
    "--agree-tos",
    "--non-interactive"
  ], { stdio: "inherit" });

  console.log(`🔐 HTTPS certificates requested for ${subdomain}.${process.env.GODADDY_DOMAIN}`);
}

async function main() {
  console.log("Request worker started...");

  while (true) {
    try {
      const job = await redis.blpop("deploy_queue", 0);
      if (!job) continue;

      const payload = JSON.parse(job[1]);
      const { id, entryPoint = "index.js", env = {}, subdomain } = payload;

      console.log(`⚡ Deploying build ${id}...`);

      const buildPath = path.join("/tmp/request", id);
      if (fs.existsSync(buildPath)) fs.rmSync(buildPath, { recursive: true, force: true });
      fs.mkdirSync(buildPath, { recursive: true });

      // Download build artifacts
      await downloadBuild(id, buildPath);

      // Deploy Docker container + reverse proxy + HTTPS
      await deployPod(id, entryPoint, env, subdomain);

      // Save deployment metadata
      await redis.hset(`build:${id}`, {
        status: "deployed",
        entryPoint,
        env: JSON.stringify(env),
        deployedAt: Date.now().toString(),
        subdomain: subdomain || "",
      });

      console.log(`✅ Deployment for ${id} completed`);
    } catch (err) {
      console.error("Deployment loop error:", err);
    }
  }
}

main();
