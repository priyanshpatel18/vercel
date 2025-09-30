import { spawnSync } from "child_process";
import "dotenv/config";
import fs from "fs";
import path from "path";

function replaceEnvVars(env?: Record<string, string>) {
  if (!env) return "";
  return Object.entries(env)
    .map(([k, v]) => `- name: ${k}\n  value: "${v}"`)
    .join("\n        ");
}

async function createSubdomain(subdomain: string) {
  const API_KEY = process.env.GODADDY_KEY!;
  const API_SECRET = process.env.GODADDY_SECRET!;
  const DOMAIN = process.env.GODADDY_DOMAIN!;
  const IP = process.env.INGRESS_IP!;

  const url = `https://api.godaddy.com/v1/domains/${DOMAIN}/records/A/${subdomain}`;

  const body = [{ data: IP, ttl: 600 }];

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `sso-key ${API_KEY}:${API_SECRET}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to create GoDaddy DNS for ${subdomain}.${DOMAIN}: ${text}`);
  } else {
    console.log(`✅ GoDaddy DNS created: ${subdomain}.${DOMAIN} → ${IP}`);
  }
}

export async function deployPod(
  id: string,
  entryPoint = "index.js",
  env?: Record<string, string>,
  subdomain?: string
) {
  const tempDir = path.join("/tmp/k8s", id);
  fs.mkdirSync(tempDir, { recursive: true });

  // Determine subdomain
  subdomain = subdomain || `${id}.${process.env.GODADDY_DOMAIN}`;
  // Create GoDaddy DNS record
  await createSubdomain(subdomain);

  // 1. Pod YAML
  const podTemplate = fs.readFileSync(path.join(__dirname, "k8sTemplates/pod.yaml"), "utf8");
  const podYaml = podTemplate
    .replace(/{{ID}}/g, id)
    .replace(/{{ENTRY_POINT}}/g, entryPoint)
    .replace(/{{ENV_VARS}}/g, replaceEnvVars(env));
  fs.writeFileSync(path.join(tempDir, "pod.yaml"), podYaml);

  // 2. Service YAML
  const svcTemplate = fs.readFileSync(path.join(__dirname, "k8sTemplates/svc.yaml"), "utf8");
  const svcYaml = svcTemplate.replace(/{{ID}}/g, id);
  fs.writeFileSync(path.join(tempDir, "svc.yaml"), svcYaml);

  // 3. Ingress YAML
  const ingressTemplate = fs.readFileSync(path.join(__dirname, "k8sTemplates/ingress.yaml"), "utf8");
  const ingressYaml = ingressTemplate
    .replace(/{{ID}}/g, id)
    .replace(/{{SUBDOMAIN}}/g, subdomain);
  fs.writeFileSync(path.join(tempDir, "ingress.yaml"), ingressYaml);

  // Apply all YAMLs
  spawnSync("kubectl", ["apply", "-f", path.join(tempDir, "pod.yaml")], { stdio: "inherit" });
  spawnSync("kubectl", ["apply", "-f", path.join(tempDir, "svc.yaml")], { stdio: "inherit" });
  spawnSync("kubectl", ["apply", "-f", path.join(tempDir, "ingress.yaml")], { stdio: "inherit" });

  console.log(`✅ Pod, service & ingress for ${id} deployed at ${subdomain}`);
}
