require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

const {
  POLYGON_RPC_URL,
  POLYGON_MAINNET_RPC_URL,
  PRIVATE_KEY,
  ETHERSCAN_API_KEY,
} = process.env;

module.exports = {
  solidity: "0.8.9",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    polygon: {
      url: POLYGON_RPC_URL,
      accounts: [`0x${PRIVATE_KEY}`],
    },
    polygonMainnet: {
      url: POLYGON_MAINNET_RPC_URL,
      accounts: [`0x${PRIVATE_KEY}`],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};