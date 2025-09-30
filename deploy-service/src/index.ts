import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { spawnSync } from "child_process";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { redis } from "./redis";

function getAllFiles(folderPath: string): string[] {
  let results: string[] = [];
  for (const file of fs.readdirSync(folderPath)) {
    const fullPath = path.join(folderPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

const s3 = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function downloadSource(id: string, destPath: string) {
  fs.mkdirSync(destPath, { recursive: true });

  const list = await s3.send(
    new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: `${id}/`,
    })
  );

  for (const obj of list.Contents ?? []) {
    const key = obj.Key!;
    const filePath = path.join(destPath, key.replace(`${id}/`, ""));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const data = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      })
    );

    const body = await data.Body?.transformToByteArray();
    if (body) fs.writeFileSync(filePath, Buffer.from(body));
  }
}

async function uploadBuild(id: string, buildPath: string) {
  const files = getAllFiles(buildPath);
  for (const file of files) {
    const relative = path.relative(buildPath, file);
    const content = fs.readFileSync(file);
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `builds/${id}/${relative}`,
        Body: content,
      })
    );
  }
}

async function worker() {
  console.log("Deployment worker started...");

  while (true) {
    const job = await redis.blpop("build_queue", 0);
    if (!job) continue;

    const payload = JSON.parse(job[1]);
    const { id } = payload;
    console.log(`⚡ Processing build ${id}`);

    const repoPath = path.join("/tmp/builds", id);
    await downloadSource(id, repoPath);

    if (fs.existsSync(path.join(repoPath, "package.json"))) {
      // Run install silently
      const installResult = spawnSync("pnpm", ["install"], {
        cwd: repoPath,
        stdio: "ignore"
      });

      // Only run build if package.json exists
      if (fs.existsSync(path.join(repoPath, "package.json"))) {
        const buildResult = spawnSync("pnpm", ["run", "build"], {
          cwd: repoPath,
          stdio: "ignore"
        });

        if (buildResult.status !== 0) {
          console.error(`Build failed for ${id}`);
        }
      }
    }

    // Upload build artifacts back to R2
    const buildPath = fs.existsSync(path.join(repoPath, "dist"))
      ? path.join(repoPath, "dist")
      : repoPath;

    await uploadBuild(id, buildPath);

    // Save build metadata
    await redis.hset(`build:${id}`, {
      status: "built",
      outputPath: `builds/${id}/`,
      updatedAt: Date.now().toString(),
    });

    const deployPayload = {
      id,
      entryPoint: "index.js",
      env: { NODE_ENV: "production" },
      subdomain: `${id}`,
    };
    await redis.rpush("deploy_queue", JSON.stringify(deployPayload));

    console.log(`Build ${id} completed`);
    fs.rmSync(repoPath, { recursive: true, force: true });
  }
}

worker();