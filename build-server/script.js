// exec is used to run shell cmd in nodejs
const { exec } = require('child_process')
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');
const { Kafka } = require('kafkajs')

const kafka = new Kafka({
  clientId: `docker-build-server-${DEPLOYMENT_ID}`,
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

const producer = kafka.producer()

async function publishLog(log) {
  producer.send({
    topic: `container-logs`,
    messages: [{ key: 'log', value: JSON.stringify({ PROJECT_ID, DEPLOYMENT_ID, log }) }],
  })
}

const s3Client = new S3Client({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.S3ACESSKEY,
    secretAccessKey: process.env.S3SECRETKEY
  }
})

const PROJECT_ID = process.env.PROJECT_ID
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID

async function init() {
  await producer.connect()
  console.log('executing project...');
  await publishLog('Build Started....')
  const outDirPath = path.join(__dirname, 'output')

  const p = exec(`cd ${outDirPath} && npm install && npm run build`)

  // track the log files
  p.stdout.on('data', async function (data) {
    console.log(data.toString());
    await publishLog(data.toString());
  });

  // track error
  p.stdout.on('error', async function (data) {
    console.error('Error', data.toString());
    await publishLog(`error: ${data.toString()}`);
  })

  // close the track
  p.on('close', async function () {

    console.log('Project built successfully🎊');

    await publishLog('Build Completed')

    const distFolderPath = path.join(__dirname, 'output', 'dist');

    // give all the files inside the folder
    const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true });

    await publishLog('Started to upload...')
    // iterate the files inside the folder
    for (const file of distFolderContents) {
      // get the full path 
      const filePath = path.join(distFolderPath, file)
      // check directory or file as assest not required, only script.js
      // lstatSync => retrieve metadata 
      if (fs.lstatSync(filePath).isDirectory()) continue;

      console.log('Uploading', filePath);

      await publishLog(`Uploading ${file}`)

      // put object on S3
      const command = new PutObjectCommand({
        Bucket: 'deployment-server-build',
        Key: `__output/${PROJECT_ID}/${file}`,  // path to store
        Body: fs.createReadStream(filePath),  // stream and put in s3 bucket
        ContentType: mime.lookup(filePath) // dynamically generated content type
      })

      // Send S3 bucket
      await s3Client.send(command)
      publishLog(`uploaded ${filePath}`)
      console.log('uploaded', filePath);

    }
    await publishLog('File uploaded to S3')
    console.log('File uploaded to S3🎉');
    process.exit(0);
  })
}

init();