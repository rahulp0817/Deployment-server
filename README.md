## Deployment Server
The deployment server is responsible for deploying the application to the production environment.

## Tech Stack & AWS Services 
- JavaScript
- NodeJS
- Docker
- Linux
- Express Js
- AWS S3 -> policy changes
- AWS ECR -> Elastic Container Registry
- AWS CLI
- AWS ECS -> Elastic Container Service 
- AWS Fargate (Serverless)
- Reverse Proxy
- Prisma
- PostgreSQL
- Zod 
- Kafka
- ClickHouse DB

## Installation
- npm init -y
- npm install @aws-sdk/client-s3
- npm i mime-types
- Express Js
- npm i http-proxy
- npm i random-word-slugs
- npm install @aws-sdk/client-ecs
- npm i zod
- npm i kafkajs
- npm i @clickhouse/client

## In AWS
- create a S3 Bucket
- create a IAM rule for it to Access all permissions
- create a ECR push commands and create docker image
- Install AWS CLI
- AWS Configure
- Use the AWS cmds and Build the Image and push
- Create ECS cluster --> AWS Fargate
- In ECS create new Task defination -> helps to run Image in a cluster

## Test the Deployment for 1 container
- Copy the git Url of a project
- ECS -> cluster (created) 
- Task -> Create Task 
- Add environment variables (git url && project Id as p1)

# RUN the Task in terminal
- docker run -it -e GIT_REPO_URL={url} -e PROJECT_ID {project_id} {ImageName}

# command used to push image {USE YOURS}
- docker build -t build-server-image .
- docker tag build-server-image:latest 476227639904.dkr.ecr.ap-south-1.amazonaws.com/build-server-image:latest
- docker push 476227639904.dkr.ecr.ap-south-1.amazonaws.com/build-server-image:latest