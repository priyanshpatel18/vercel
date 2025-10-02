import { spawnSync, spawn } from "child_process";
import path from "path";
import { downloadBuild } from "./r2";

export async function startTenant(id: string, env: Record<string, string> = {}) {
  const tenantDir = path.join("/tmp/tenants", id);
  
  // 1️⃣ Download build artifacts
  await downloadBuild(id, tenantDir);

  // 2️⃣ Install npm dependencies (production only)
  console.log(`Installing dependencies for tenant ${id}...`);
  const install = spawnSync("pnpm", ["install", "--production"], {
    cwd: tenantDir,
    stdio: "inherit",
  });

  if (install.status !== 0) {
    throw new Error(`npm install failed for tenant ${id}`);
  }

  // 3️⃣ Spawn tenant server
  const child = spawn("node", ["index.js"], {
    cwd: tenantDir,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });

  child.on("exit", (code) =>
    console.log(`Tenant ${id} exited with code ${code}`)
  );

  console.log(`Tenant ${id} server started`);
  return child;
}
