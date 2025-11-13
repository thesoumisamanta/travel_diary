#!/usr/bin/env bash
set -e
ROOT="youtube-backend"
mkdir -p $ROOT/src/{config,controllers,models,routes,middlewares,services,validators,utils}
mkdir -p $ROOT/public/uploads/videos
cat > $ROOT/package.json <<'JSON'
{ "name":"youtube-backend","version":"1.0.0" }
JSON
cat > $ROOT/.env.sample <<'ENV'
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/youtube_clone
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ENV
echo "Scaffold created in $ROOT. Now open and paste code files from the template."
