import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs'
import "dotenv/config"
import express, { json } from 'express'
import { generateSlug } from 'random-word-slugs'

const app = express()
const PORT = 9000

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  R2_KEY_ID,
  R2_SECRET_KEY,
  R2_ENDPOINT,
  CLUSTER,
  TASK
} = process.env;

const ecsClient = new ECSClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
})

app.use(json())

app.post('/project', async (req, res) => {
  const { gitURL, slug } = req.body
  const projectSlug = slug ? slug : generateSlug()

  // Spin the container
  const command = new RunTaskCommand({
    cluster: CLUSTER,
    taskDefinition: TASK,
    launchType: 'FARGATE',
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: 'ENABLED',
        subnets: ['subnet-0a24c83ceffbba94f', 'subnet-0de66aa241030947a', 'subnet-025c6e1e68349829f '],
        securityGroups: ['sg-0694778b265b0fe07']
      }
    },
    overrides: {
      containerOverrides: [
        {
          name: 'builder-image',
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

  await ecsClient.send(command);

  return res.json({ status: 'queued', data: { projectSlug, url: `http://${projectSlug}.localhost:8000` } })
})

app.listen(PORT, () => console.log(`API Server Running on port ${PORT}`))