require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

// Load environment variables
const {
  PRIVATE_KEY_MAINNET,
  PRIVATE_KEY_TESTNET,
  INFURA_API_KEY,
  ALCHEMY_API_KEY,
  ETHERSCAN_API_KEY,
  POLYGONSCAN_API_KEY,
} = process.env;

module.exports = {
  // Directory for compiled contracts and ABIs
  contracts_build_directory: "./build/contracts",

  networks: {
    // Mainnet (Ethereum)
    mainnet: {
      provider: () =>
        new HDWalletProvider(PRIVATE_KEY_MAINNET, `https://mainnet.infura.io/v3/${INFURA_API_KEY}`),
      network_id: 1, // Ethereum mainnet ID
      gas: 5000000, // Adjust gas limit
      gasPrice: 20000000000, // 20 Gwei
      confirmations: 2, // Wait for 2 confirmations
      timeoutBlocks: 200, // Increase timeout for mainnet transactions
      skipDryRun: true,
    },

    // Testnet (Ropsten)
    ropsten: {
      provider: () =>
        new HDWalletProvider(PRIVATE_KEY_TESTNET, `https://ropsten.infura.io/v3/${INFURA_API_KEY}`),
      network_id: 3, // Ropsten network ID
      gas: 5000000,
      gasPrice: 10000000000, // 10 Gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },

    // Testnet (Rinkeby)
    rinkeby: {
      provider: () =>
        new HDWalletProvider(PRIVATE_KEY_TESTNET, `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`),
      network_id: 4, // Rinkeby network ID
      gas: 5000000,
      gasPrice: 10000000000, // 10 Gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },

    // Polygon Mainnet
    polygon: {
      provider: () =>
        new HDWalletProvider(PRIVATE_KEY_MAINNET, `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
      network_id: 137, // Polygon network ID
      gas: 6000000,
      gasPrice: 30000000000, // 30 Gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },

    // Polygon Mumbai Testnet
    mumbai: {
      provider: () =>
        new HDWalletProvider(PRIVATE_KEY_TESTNET, `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
      network_id: 80001, // Mumbai network ID
      gas: 6000000,
      gasPrice: 3000000000, // 3 Gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },

    // LayerZero-Compatible Network (Example Configuration)
    layerzero: {
      provider: () =>
        new HDWalletProvider(PRIVATE_KEY_TESTNET, `https://layerzero.network/${INFURA_API_KEY}`),
      network_id: "*", // Dynamic network ID for LayerZero networks
      gas: 5000000,
      gasPrice: 10000000000, // 10 Gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },

  // Configure compilers with Solidity 0.8.0 and optimizations
  compilers: {
    solc: {
      version: "0.8.0", // Use Solidity 0.8.0
      settings: {
        optimizer: {
          enabled: true, // Enable optimizer
          runs: 200, // Optimize for fewer runs to reduce gas costs
        },
      },
    },
  },

  // Truffle plugins
  plugins: [
    "truffle-plugin-verify" // Plugin to verify contracts on Etherscan and Polygonscan
  ],

  // API keys for contract verification
  api_keys: {
    etherscan: ETHERSCAN_API_KEY,
    polygonscan: POLYGONSCAN_API_KEY,
  },

  // Mocha settings for contract testing
  mocha: {
    timeout: 100000, // Increase timeout to prevent flaky tests on testnets
  },

  // LayerZero cross-chain configuration (Example)
  layerzero: {
    enabled: true,
    networks: ["ethereum", "polygon"], // Enable cross-chain deployment
  },
};
