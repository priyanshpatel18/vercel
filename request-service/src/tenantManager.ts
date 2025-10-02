import { spawn } from "child_process";
import path from "path";
import { downloadBuild } from "./r2";

export async function startTenant(id: string, env: Record<string, string> = {}) {
  const tenantDir = path.join("/tmp/tenants", id);
  await downloadBuild(id, tenantDir);

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
