const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { execSync } = require('child_process');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const dotenv = require('dotenv');
dotenv.config()

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  R2_ENDPOINT,
  PROJECT_ID
} = process.env;

const s3 = new S3Client({
  region: AWS_REGION,
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

const localZip = `/tmp/${PROJECT_ID}.zip`;

(async () => {
  try {
    console.log(`⬇️ Downloading ${PROJECT_ID}.zip from R2...`);
    const data = await s3.send(new GetObjectCommand({
      Bucket: 'solixdb',
      Key: `__backups/${PROJECT_ID}.zip`
    }));

    await pipeline(data.Body, createWriteStream(localZip));

    console.log(`📂 Extracting ${PROJECT_ID}.zip...`);
    execSync(`mkdir -p /home/app/output && unzip -o ${localZip} -d /home/app/output`, {
      stdio: 'inherit'
    });

    console.log('✅ Backup restored successfully.');
  } catch (err) {
    console.error('❌ Error restoring backup:', err);
    process.exit(1);
  }
})();
