const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.getBalance();
  console.log("Account balance:", balance.toString());

  const NFTContract = await hre.ethers.getContractFactory("NFTContract");
  const nftContract = await NFTContract.deploy();
  await nftContract.deployed();

  console.log("NFTContract deployed to:", nftContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });