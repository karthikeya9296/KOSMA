// Load required packages
require("dotenv").config();
const fs = require("fs");
const { execSync } = require("child_process");

// Environment variables
const {
  GRAPH_ACCESS_TOKEN,
  NETWORK = "polygon",
  SUBGRAPH_NAME = "kosma-subgraph",
  KOSMA_NFT_ADDRESS,
  STORY_INTEGRATION_ADDRESS,
  KOSMA_PAYMENTS_ADDRESS,
  GRAPH_NODE_URL = "https://api.thegraph.com/deploy/",
} = process.env;

// Define contract ABIs and event handlers for The Graph
const contractSources = [
  {
    name: "KosmaNFT",
    address: KOSMA_NFT_ADDRESS,
    abiPath: "./abis/KosmaNFT.json",
    events: [{ name: "NFTMinted", handler: "handleNFTMinted" }],
    startBlock: 1000000, // Replace with the correct block number
  },
  {
    name: "StoryIntegration",
    address: STORY_INTEGRATION_ADDRESS,
    abiPath: "./abis/StoryIntegration.json",
    events: [{ name: "RoyaltyPaid", handler: "handleRoyaltyPaid" }],
    startBlock: 1500000,
  },
  {
    name: "KosmaPayments",
    address: KOSMA_PAYMENTS_ADDRESS,
    abiPath: "./abis/KosmaPayments.json",
    events: [
      { name: "PaymentStreamStarted", handler: "handlePaymentStreamStarted" },
      { name: "MembershipPurchased", handler: "handleMembershipPurchased" },
    ],
    startBlock: 2000000,
  },
];

// Helper function to execute shell commands with logging and error handling
const execCommand = (command) => {
  console.log(`Executing: ${command}`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`❌ Error executing command: ${command}`, error.message);
    process.exit(1);
  }
};

// Generate the subgraph.yaml manifest file
const generateManifest = () => {
  console.log("🛠 Generating subgraph.yaml...");

  const dataSources = contractSources.map((source) => ({
    kind: "ethereum/contract",
    name: source.name,
    network: NETWORK,
    source: {
      address: source.address,
      abi: source.name,
      startBlock: source.startBlock,
    },
    mapping: {
      kind: "ethereum/events",
      apiVersion: "0.0.5",
      language: "wasm/assemblyscript",
      entities: [source.name],
      abis: [{ name: source.name, file: source.abiPath }],
      eventHandlers: source.events.map((event) => ({
        event: `${event.name}(address,uint256)`,
        handler: event.handler,
      })),
      file: "./src/mapping.ts",
    },
  }));

  const manifest = {
    specVersion: "0.0.4",
    description: "Subgraph for Kosma platform contracts",
    repository: "https://github.com/karthikeya9296/KOSMA",
    schema: { file: "./schema.graphql" },
    dataSources,
  };

  fs.writeFileSync("subgraph.yaml", JSON.stringify(manifest, null, 2));
  console.log("✅ subgraph.yaml generated successfully.");
};

// Initialize the subgraph project
const initializeSubgraph = () => {
  console.log("🚀 Initializing subgraph...");
  execCommand(`graph init --product hosted-service ${SUBGRAPH_NAME} --from-example`);
  generateManifest();
};

// Deploy the subgraph
const deploySubgraph = () => {
  console.log("🚀 Deploying subgraph...");
  execCommand(`graph auth --product hosted-service ${GRAPH_ACCESS_TOKEN}`);
  execCommand(`graph codegen && graph build`);
  execCommand(`graph deploy --product hosted-service ${SUBGRAPH_NAME}`);
  console.log("🎉 Subgraph deployed successfully.");
};

// Main function to create, configure, and deploy the subgraph with error handling
const main = async () => {
  try {
    console.log("🏗 Starting subgraph creation process...");
    initializeSubgraph();
    deploySubgraph();
    console.log("✅ Subgraph creation and deployment completed.");
  } catch (error) {
    console.error("❌ Subgraph creation failed:", error.message);
    process.exit(1);
  }
};

// Execute the main function
main();
