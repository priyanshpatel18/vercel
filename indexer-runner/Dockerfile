FROM ubuntu:focal

SHELL ["/bin/bash", "-c"]

RUN apt-get update && \
    apt-get install -y curl git unzip zip ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest && \
    npm install -g pnpm@latest && \
    apt-get clean

WORKDIR /home/app

COPY package*.json ./
RUN pnpm install

COPY main.sh runner.js upload-backup.js restore-backup.js check-backup.js ./

RUN chmod +x main.sh runner.js upload-backup.js restore-backup.js check-backup.js

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/home/app/main.sh"]
