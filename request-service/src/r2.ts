import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

export async function downloadBuild(id: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const obj = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `builds/${id}/index.js`,
    })
  );

  const body = await obj.Body?.transformToByteArray();
  if (!body) throw new Error("Build not found in S3");
  fs.writeFileSync(path.join(dest, "index.js"), Buffer.from(body));
}
