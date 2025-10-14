import cors from "cors";
import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import simpleGit from "simple-git";
import { redis } from "./redis";
import { deletePrefix, generate, getAllFiles, uploadFile } from './utils';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const PORT = process.env.PORT ?? 3000;

app.post("/deploy", async (req, res) => {
  const repoUrl = req.body.repoUrl;
  if (!repoUrl) {
    return res.status(400).json({ error: "repoUrl is required" });
  }

  const id = generate();
  const repoPath = path.join("output", id);

  // Immediately respond to user
  res.json({
    id,
    message: "Deployment request received. Your build is queued.",
  });

  try {
    // Set initial status
    await redis.hset(`build:${id}`, {
      status: "queued",
      message: "Deployment request received",
      updatedAt: Date.now().toString(),
    });

    // Step 1: Cloning repo
    await redis.hset(`build:${id}`, { status: "processing", message: "Cloning repository..." });
    console.log(`Cloning repo: ${repoUrl}`);
    await simpleGit().clone(repoUrl, repoPath, ["--depth", "1"]);

    // Step 2: Upload files
    await redis.hset(`build:${id}`, { message: "Uploading files to storage..." });
    console.log("Uploading files...");
    const files = getAllFiles(repoPath);
    for (const file of files) {
      const relativePath = path.relative(repoPath, file);
      const s3Key = `${id}/${relativePath}`;
      await uploadFile(s3Key, file);
    }

    // Step 3: Queue build worker
    await redis.hset(`build:${id}`, { message: "Build queued for processing..." });
    const payload = { id, repo: repoUrl, timestamp: Date.now() };
    await redis.rpush("build_queue", JSON.stringify(payload));

    // Step 4: Cleanup local repo
    await fs.promises.rm(repoPath, { recursive: true, force: true });
    await redis.hset(`build:${id}`, { message: "Local cleanup done. Waiting for build worker." });

    console.log(`Deployment job ${id} queued successfully.`);
  } catch (error) {
    console.error(`Deployment job ${id} failed:`, error);
    await redis.hset(`build:${id}`, {
      status: "failed",
      message: "Deployment failed",
      updatedAt: Date.now().toString(),
    });
  }
});

app.get("/deploy/status/:id", async (req, res) => {
  const { id } = req.params;
  const status = await redis.hgetall(`build:${id}`);
  if (!status || Object.keys(status).length === 0) {
    return res.status(404).json({ error: "Deployment not found" });
  }
  res.json(status);
});

app.listen(PORT, () => {
  deletePrefix()
  console.log(`Listening to port ${PORT}`);
});