#!/bin/bash

# Step 1: Check if required dependencies are installed
echo "Checking for required dependencies..."

REQUIRED_CMDS=("node" "yarn" "truffle")

for cmd in "${REQUIRED_CMDS[@]}"; do
    if ! command -v $cmd &> /dev/null; then
        echo "$cmd could not be found. Please install it before proceeding."
        exit 1
    fi
done

echo "All required dependencies are installed."

# Step 2: Navigate to the project directory
PROJECT_DIR="$(pwd)/KOSMA-main"
cd "$PROJECT_DIR" || exit

# Step 3: Install backend and frontend dependencies
echo "Installing backend dependencies..."
cd backend && yarn install
echo "Backend dependencies installed."

echo "Installing frontend dependencies..."
cd ../frontend && yarn install
echo "Frontend dependencies installed."

# Step 4: Set up environment variables
echo "Setting up environment variables..."
if [ -f "../.env" ]; then
    export $(cat ../.env | xargs)
    echo "Environment variables loaded."
else
    echo ".env file not found. Make sure to create and configure it."
    exit 1
fi

# Step 5: Deploy smart contracts (Truffle)
echo "Deploying smart contracts..."
cd ../Contracts
truffle migrate --network development
echo "Smart contracts deployed."

# Step 6: Start backend and frontend services
echo "Starting backend service..."
cd ../backend
yarn start &

echo "Starting frontend service..."
cd ../frontend
yarn start &

echo "Deployment complete. Backend and frontend are running."
