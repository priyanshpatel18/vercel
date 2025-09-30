import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

const s3 = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function downloadBuild(id: string, destPath: string) {
  fs.mkdirSync(destPath, { recursive: true });

  const list = await s3.send(new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET_NAME,
    Prefix: `builds/${id}/`,
  }));

  for (const obj of list.Contents ?? []) {
    const key = obj.Key!;
    const filePath = path.join(destPath, key.replace(`builds/${id}/`, ""));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const data = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    const body = await data.Body?.transformToByteArray();
    if (body) fs.writeFileSync(filePath, Buffer.from(body));
  }
}
