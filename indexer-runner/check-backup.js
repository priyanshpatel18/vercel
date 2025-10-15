const { HeadObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const dotenv = require('dotenv');
dotenv.config();

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

(async () => {
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: 'solixdb',
      Key: `__backups/${PROJECT_ID}.zip`
    }));
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
})();
