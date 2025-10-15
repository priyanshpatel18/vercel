const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { execSync } = require('child_process');
const { createReadStream } = require('fs');
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

const outputZip = `/tmp/${PROJECT_ID}.zip`;

(async () => {
  console.log(`📦 Zipping repo for ${PROJECT_ID}...`);
  execSync(`cd /home/app/output && zip -r ${outputZip} .`, { stdio: 'inherit' });

  console.log(`⬆️ Uploading ${PROJECT_ID}.zip to R2...`);
  await s3.send(new PutObjectCommand({
    Bucket: 'solixdb',
    Key: `__backups/${PROJECT_ID}.zip`,
    Body: createReadStream(outputZip),
    ContentType: 'application/zip'
  }));

  console.log('✅ Backup uploaded to R2');
})();
