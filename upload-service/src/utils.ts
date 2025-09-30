import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

export function getAllFiles(folderPath: string) {
  let response: string[] = [];

  const allFilesAndFolders = fs.readdirSync(folderPath); allFilesAndFolders.forEach(file => {
    const fullFilePath = path.join(folderPath, file);
    if (fs.statSync(fullFilePath).isDirectory()) {
      response = response.concat(getAllFiles(fullFilePath))
    } else {
      response.push(fullFilePath);
    }
  });
  return response;
}

export function generate() {
  const subset = "123456789qwertyuiopasdfghjklzxcvbnm";
  const length = 5;
  let id = "";
  for (let i = 0; i < length; i++) {
    id += subset[Math.floor(Math.random() * subset.length)];
  }
  return id;
}

const s3 = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const uploadFile = async (fileName: string, localFilePath: string) => {
  const fileContent = fs.readFileSync(localFilePath);
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: fileName,
    Body: fileContent
  });
  await s3.send(command);
}

export async function deletePrefix(prefix?: string) {
  const bucket = process.env.R2_BUCKET_NAME;

  // List all objects under prefix
  const list = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix ?? "",
  }));
  console.log(list.Contents);
  

  if (!list.Contents || list.Contents.length === 0) {
    return;
  }

  const objects = list.Contents.map(obj => ({ Key: obj.Key }));

  await s3.send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: objects },
  }));
}