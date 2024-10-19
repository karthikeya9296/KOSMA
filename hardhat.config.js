require('dotenv').config();

console.log("Loaded Private Key:", process.env.PRIVATE_KEY);

module.exports = {
  solidity: "0.8.27",
  networks: {
    polygon: {
      url: "https://polygon-rpc.com/",
      accounts: [process.env.PRIVATE_KEY ? `0x${process.env.PRIVATE_KEY}` : ""],
    },
    polygonMumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: [process.env.PRIVATE_KEY ? `0x${process.env.PRIVATE_KEY}` : ""],
    },
  },
};
