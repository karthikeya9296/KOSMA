#!/bin/bash

# Exit immediately if any command exits with a non-zero status
set -e

# Load environment variables from .env securely
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "❌ Error: .env file not found. Please create one with the necessary configurations."
  exit 1
fi

# Colors for better console output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Variables
BUILD_DIR="build"
PLATFORM=$1 # The hosting platform specified as a command-line argument
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""} # Optional: Slack webhook for notifications

# Usage function to guide users
usage() {
  echo -e "${YELLOW}Usage: ./deployFrontend.sh [aws|netlify|vercel|cloudflare]${NC}"
  exit 1
}

# Function to send notifications to Slack
notify() {
  local message=$1
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -s -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$message\"}" $SLACK_WEBHOOK_URL > /dev/null
  fi
}

# Function to build the React application
build_app() {
  echo -e "${GREEN}Optimizing and building the React app...${NC}"
  npm install --silent
  npm run build --silent
  echo -e "${GREEN}Build completed successfully!${NC}"
}

# Ensure dependencies are installed
check_dependencies() {
  echo -e "${GREEN}Checking dependencies...${NC}"
  for cmd in aws netlify vercel npx; do
    if ! command -v $cmd &> /dev/null; then
      echo -e "${RED}Error: $cmd is not installed.${NC} Please install it and try again."
      exit 1
    fi
  done
}

# Function to deploy to AWS S3 and CloudFront
deploy_aws() {
  echo -e "${GREEN}Deploying to AWS S3...${NC}"
  aws s3 sync $BUILD_DIR s3://$AWS_S3_BUCKET --delete --exact-timestamps

  if [ -n "$AWS_CLOUDFRONT_ID" ]; then
    echo -e "${GREEN}Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation \
      --distribution-id $AWS_CLOUDFRONT_ID --paths "/*" \
      --no-paginate --output json &
  fi

  wait # Wait for all background tasks to complete
  echo -e "${GREEN}AWS deployment completed successfully!${NC}"
  notify "Kosma frontend deployed to AWS S3 and CloudFront!"
}

# Function to deploy to Netlify
deploy_netlify() {
  echo -e "${GREEN}Deploying to Netlify...${NC}"
  netlify deploy --dir=$BUILD_DIR --prod --json
  echo -e "${GREEN}Netlify deployment completed successfully!${NC}"
  notify "Kosma frontend deployed to Netlify!"
}

# Function to deploy to Vercel
deploy_vercel() {
  echo -e "${GREEN}Deploying to Vercel...${NC}"
  vercel --prod --confirm --token $VERCEL_TOKEN
  echo -e "${GREEN}Vercel deployment completed successfully!${NC}"
  notify "Kosma frontend deployed to Vercel!"
}

# Function to deploy to Cloudflare Pages
deploy_cloudflare() {
  echo -e "${GREEN}Deploying to Cloudflare Pages...${NC}"
  npx wrangler pages publish $BUILD_DIR --project-name=$CLOUDFLARE_PROJECT_NAME
  echo -e "${GREEN}Cloudflare Pages deployment completed successfully!${NC}"
  notify "Kosma frontend deployed to Cloudflare Pages!"
}

# Rollback logic for different platforms
rollback() {
  echo -e "${RED}Deployment failed! Rolling back...${NC}"
  case $PLATFORM in
    aws)
      echo -e "${YELLOW}Reverting to the previous version on AWS S3...${NC}"
      aws s3 sync s3://$AWS_S3_BUCKET/backup $BUILD_DIR --delete
      ;;
    netlify|vercel|cloudflare)
      echo -e "${YELLOW}Rollback logic for $PLATFORM is not implemented.${NC}"
      ;;
  esac
  notify "Kosma frontend deployment failed! Rolling back changes."
  exit 1
}

# Error handling with rollback
trap rollback ERR

# Main deployment logic
main() {
  if [ -z "$PLATFORM" ]; then
    echo -e "${RED}Error: No platform specified.${NC}"
    usage
  fi

  check_dependencies
  build_app

  case $PLATFORM in
    aws)
      deploy_aws
      ;;
    netlify)
      deploy_netlify
      ;;
    vercel)
      deploy_vercel
      ;;
    cloudflare)
      deploy_cloudflare
      ;;
    *)
      echo -e "${RED}Error: Invalid platform specified.${NC}"
      usage
      ;;
  esac

  echo -e "${GREEN}Frontend deployment completed successfully!${NC}"
}

# Execute the main function
main
