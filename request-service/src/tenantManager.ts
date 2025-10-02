import { spawn } from "child_process";
import path from "path";

export async function startTenant(id: string, env: Record<string, string> = {}) {
  const tenantDir = path.join("/tmp/tenants", id);

  const child = spawn("node", ["index.js"], {
    cwd: tenantDir,
    env: { ...process.env, ...env, NODE_PATH: "/opt/shared-node/node_modules" },
    stdio: "inherit",
  });

  child.on("exit", (code) =>
    console.log(`Tenant ${id} exited with code ${code}`)
  );

  console.log(`Tenant ${id} server started`);
  return child;
}
