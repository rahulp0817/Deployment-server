const express = require('express');
const { generateSlug } = require('random-word-slugs');
const { ECSCLient, RunTaskCommand, ECSClient } = require('@aws-sdk/client-ecs')
const { Server } = require('socket.io');
const cors = require('cors')
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client')
const { createClient } = require('@clickhouse/client')
const { Kafka } = require('kafkajs')


const app = express();
const PORT = process.env.PORT || 9000;

// prisma client
const prisma = new PrismaClient({});

const io = new Server({ cors: '*' });

// kafka
const kafka = new Kafka({
  clientId: `api-server`,
  brokers: ['deployment-server-vishnupradhan559-3e64.k.aivencloud.com:23167'],
  ssl: {
    ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')]
  },
  sasl: {
    username: 'avnadmin',
    password: process.env.KAFKAPASS,
    mechanism: 'plain',
  }
})

// clickhouse
const client = createClient({
  host: 'https://clickhouse-deployment-server-vishnupradhan559-3e64.h.aivencloud.com',
  database: 'default',
  user: 'avnadmin',
  password: process.env.CLICKHOUSEPASS
})

const consumer = kafka.consumer({ groupId: 'api-server-logs-consumer' })

// aws ecs
const ecsClient = new ECSClient({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.ECSACCESSKEY,
    secretAccessKey: process.env.ECSSECRETKEY
  }
})

// ARN
const config = {
  CLUSTER: 'arn:aws:ecs:ap-south-1:476227639904:cluster/deployment-build-cluster',
  TASK: 'arn:aws:ecs:ap-south-1:476227639904:task-definition/deployment-build-task'
}

app.use(express.json());

app.post('/project', async (req, res) => {
  //Zod validations
  const schema = z.object({
    name: z.string(),
    gitURL: z.string().url()
  })
  const safeParse = schema.safeParse(req.body);

  if (!safeParse.success) {
    return res.status(400).json(safeParse.error.issues);
  }

  const { name, gitURL } = safeParse.data

  const project = await prisma.project.create({
    data: {
      name,
      gitURL,
      subDomain: generateSlug()
    }
  })
  return res.json({
    status: 'success',
    data: { project: project }
  })
})
app.post('/deploy', async (req, res) => {
  const { projectId } = req.body;

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return res.status(404).json({
      error: 'Project not found'
    });
  }

  const deployment = await prisma.deployment.create({
    data: {
      project: { connect: { id: projectId } },
      status: 'Queued'
    }
  })

  // spin the conatiner(like Run task)
  const command = new RunTaskCommand({
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: 'FARGATE',
    count: 1,
    platformVersion: 'LATEST',
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: ['subnet-08107b7755b69b441', 'subnet-042665cedd6fb786a', 'subnet-0900612c6b24e3ad5'],
        securityGroups: ['sg-0659402af8c08f4a7'],
        assignPublicIp: 'ENABLED'
      }
    },
    overrides: {
      containerOverrides: [
        {
          name: 'build-server-image',
          environment: [
            {
              name: 'GIT_REPO_URL', value: project.gitURL
            },
            {
              name: 'PROJECT_ID', value: projectId
            },
            {
              name: 'DEPLOYMENT_ID', value: deployment.id
            }
          ]
        }
      ]
    }
  })

  // run the cmd to spin the task cluster
  await ecsClient.send(command);
  return res.json({
    status: 'Queued',
    data: {
      projectSlug, url: `http://${projectSlug}.localhost:8000`
    }
  })

})
app.listen(PORT, () => console.log(`listening on port ${PORT}`));

// log events table create clickhouse
// CREATE TABLE log_events (
//   event_id UUID,
//   timestamp DateTime MATERIALIZED now(),
//   deployment_id Nullable(String),
//   log String,
//   metadata Nullable(String)
// )
// ENGINE=MergeTree PARTITION BY toYYYYMM(timestamp)
// ORDER BY (timestamp, event_id);