#!/usr/bin/env bash

CONTAINER_NAME=authjs-strapi-test
IMAGE_NAME=authjs-strapi-image
CONTAINER_PORT="1337:1337"

#
# Dockerfile based on https://docs.strapi.io/dev-docs/installation/docker
# Using Node v20 Alpine
# Database: sqlite
# Database file: database/testauthdata.db
# Strapi is instantiated using the yarn create strapi starter app
#   - Name: testauth
#   - Options: No git, skip cloud, js, example, install, dbclient sqlite
# The Strapi Super admin:
#   - Email: strapi@noemail.com
#   - Password: @authStrap1
#   - Firstname= strapi, lastname=strapi
# The docker build will create an API key with full access to everything
# The Auth.js schema is stored in folder schema/src/api
#   - auth-account, auth-session, auth-user, auth-verification-token
#
cat << EOF > test/dockerfile
FROM node:20-alpine
# Installing libvips-dev for sharp Compatibility
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev nasm bash vips-dev git nano
ARG NODE_ENV=development
ENV NODE_ENV=\${NODE_ENV}
WORKDIR /opt/
RUN yarn global add node-gyp
RUN yarn config set network-timeout 600000 -g && yarn install
ENV PATH=/opt/node_modules/.bin:\$PATH
WORKDIR /opt/app
RUN chown -R node:node /opt/app
USER node
ENV DATABASE_CLIENT=sqlite
ENV DATABASE_FILENAME=database/testauthdata.db
RUN ["yarn", "create","strapi","testauth","--no-git-init","--skip-cloud","--js","--no-run","--dbclient","sqlite","--example","--install"]
WORKDIR /opt/app/testauth
RUN ["yarn", "build"]
RUN ["yarn","strapi","admin:create","--email","strapi@noemail.com","--password","@uthStrap1","--firstname","strapi","--lastname","strapi"]
RUN ["yarn","strapi","telemetry:disable"]
# Create STRAPI API Key
COPY ./test/strapi_console_input.txt strapi_console_input.txt
RUN echo ".load strapi_console_input.txt" | yarn strapi console
RUN cat strapi_api_key.txt
COPY --chown=node schema/src/api/auth-user src/api/auth-user
COPY --chown=node schema/src/api/auth-session src/api/auth-session
COPY --chown=node schema/src/api/auth-account src/api/auth-account
COPY --chown=node schema/src/api/auth-verification-token src/api/auth-verification-token
CMD ["yarn", "develop"]
EOF

# 
# Generate API token using Strapi console
#   - File in docker image: strapi_api_key.txt
#   The file is extrated from the image and 
#   content is added to the .env.local file
#
cat << EOF > test/strapi_console_input.txt
const fs = require('node:fs');
const attributes = { name: 'authjstest', description: 'Token for Auth.js strapi adapter testing', type: 'full-access',lifespan: null, };
const apiToken = await strapi.service('admin::api-token').create(attributes);
const out = "STRAPI_API_KEY=" + apiToken.accessKey;
await fs.writeFileSync('strapi_api_key.txt', out);
EOF


# Build image
docker build -f test/dockerfile -t $IMAGE_NAME .
RC=$?

if [ $RC -ne 0 ]; then
  echo "Build failed ..."
  exit 1
fi

# Clean up build files
rm test/dockerfile test/strapi_console_input.txt

# Extract api key for tests
STRAPI_API_KEY=`docker run --rm \
  -p ${CONTAINER_PORT} \
  ${IMAGE_NAME} \
  cat strapi_api_key.txt | grep STRAPI_API_ `

# Extract Strapi version from second last line
STRAPI_VERSION=`docker run --rm \
  -p ${CONTAINER_PORT} \
  ${IMAGE_NAME} \
  yarn strapi version | tail -n 2 | head -n 1`

# Setup Environment, add STRAPI_URL and STRAPI_API_KEY to .env.local
echo "# Built for Strapi version $STRAPI_VERSION" > .env.local
echo "STRAPI_URL=http://localhost:1337" >> .env.local
echo $STRAPI_API_KEY >> .env.local

# Starting container
docker run -d --rm \
  --name ${CONTAINER_NAME} \
  -p ${CONTAINER_PORT} \
  ${IMAGE_NAME}

echo "waiting 25s for db to start..."
sleep 25

# Always stop container, but exit with 1 when tests are failing
if vitest run -c ../utils/vitest.config.ts; then
  echo "Tests succeeded... Stopping container..."
  docker stop ${CONTAINER_NAME}
else
  echo "Tests failed... Stopping container..."
  docker stop ${CONTAINER_NAME} && exit 1
fi

