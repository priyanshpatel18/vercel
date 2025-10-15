import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import "dotenv/config";
import express, { json } from 'express';
import { generateSlug } from 'random-word-slugs';
import Redis from 'ioredis';

const app = express();
const PORT = 9000;

const redis = new Redis({ host: '127.0.0.1', port: 6379 });

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  R2_KEY_ID,
  R2_SECRET_KEY,
  R2_ENDPOINT,
  ECS_CLUSTER,
  ECS_TASK
} = process.env;

const ecsClient = new ECSClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

app.use(json());

app.post('/project', async (req, res) => {
  try {
    const { gitURL, slug } = req.body;
    const projectSlug = slug || generateSlug();

    // Spin the ECS EC2 container
    const command = new RunTaskCommand({
      cluster: ECS_CLUSTER,
      taskDefinition: ECS_TASK,
      launchType: 'EC2',
      count: 1,p
      overrides: {
        containerOverrides: [
          {
            name: 'process-runner',
            environment: [
              { name: 'GIT_REPOSITORY__URL', value: gitURL },
              { name: 'AWS_ACCESS_KEY_ID', value: R2_KEY_ID },
              { name: 'AWS_SECRET_ACCESS_KEY', value: R2_SECRET_KEY },
              { name: 'AWS_REGION', value: "auto" },
              { name: 'R2_ENDPOINT', value: R2_ENDPOINT },
              { name: 'PROJECT_ID', value: projectSlug }
            ]
          }
        ]
      }
    });

    const result = await ecsClient.send(command);

    const hostPort = result.tasks[0].containers[0].networkBindings[0].hostPort;

    await redis.set(`project:${projectSlug}`, JSON.stringify({ taskArn: result.tasks[0].taskArn }));

    res.json({
      status: 'queued',
      data: {
        projectSlug,
        url: `http://${EC2_PUBLIC_IP}:${hostPort}`
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.listen(PORT, () => console.log(`API Server Running on port ${PORT}`));
