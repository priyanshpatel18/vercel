const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { spawn } = require('child_process');
require('dotenv').config();
const { createReadStream, lstatSync, readdirSync } = require('fs');
const { lookup } = require('mime-types');
const { join } = require('path');

const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, R2_ENDPOINT, PROJECT_ID } = process.env;

const s3Client = new S3Client({
  endpoint: R2_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

async function init() {
  console.log('Executing script.js');
  const outDirPath = join(__dirname, 'output');

  const p = spawn('bash', ['-c', `cd ${outDirPath} && npm install && npm run build`], { stdio: 'inherit' });

  await new Promise((resolve, reject) => {
    p.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed with code ${code}`));
    });
  });

  console.log('Build Complete');
  const distFolderPath = join(__dirname, 'output', 'dist');
  const distFolderContents = readdirSync(distFolderPath, { recursive: true });

  for (const file of distFolderContents) {
    const filePath = join(distFolderPath, file);
    if (lstatSync(filePath).isDirectory()) continue;

    console.log('uploading', filePath);

    const command = new PutObjectCommand({
      Bucket: 'solixdb',
      Key: `__outputs/${PROJECT_ID}/${file}`,
      Body: createReadStream(filePath),
      ContentType: lookup(filePath)
    });

    await s3Client.send(command);
    console.log('uploaded', filePath);
  }

  console.log('Done...');
  process.exit(0);
}

init().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
