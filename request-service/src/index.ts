import "dotenv/config";
import { redis } from "./redis";
import { startTenant } from "./tenantManager";
import { createSubdomain } from "./dns";

async function worker() {
  console.log("Request service worker started...");

  while (true) {
    try {
      const job = await redis.blpop("deploy_queue", 0);
      if (!job) continue;

      const payload = JSON.parse(job[1]);
      const { id, env = {}, subdomain } = payload;

      if (!subdomain) throw new Error("Subdomain is required");

      console.log(`⚡ Deploying tenant ${id}...`);

      // 1️⃣ Start Node server
      await startTenant(id, env);

      // 2️⃣ Create DNS record
      await createSubdomain(subdomain);

      // 3️⃣ Save deployment metadata
      await redis.hset(`build:${id}`, {
        status: "deployed",
        deployedAt: Date.now().toString(),
        subdomain,
      });

      console.log(`✅ Deployment for ${id} completed`);
    } catch (err) {
      console.error("Worker loop error:", err);
    }
  }
}

worker();
