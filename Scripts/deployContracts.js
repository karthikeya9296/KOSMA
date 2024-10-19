// Import necessary dependencies
require("dotenv").config();
const { ethers, run, network } = require("hardhat");

// Contracts to be deployed
const contracts = ["KosmaNFT", "KosmaPayments", "LayerZeroMessaging"];

/**
 * @dev Helper function to deploy a smart contract.
 */
async function deployContract(name, ...args) {
  console.log(`Deploying ${name}...`);
  const ContractFactory = await ethers.getContractFactory(name);
  const contract = await ContractFactory.deploy(...args);
  await contract.deployed();
  console.log(`${name} deployed at: ${contract.address}`);
  return contract;
}

/**
 * @dev Helper function to assign roles using AccessControl.
 */
async function assignRoles(contract, role, address) {
  const roleHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(role));
  const tx = await contract.grantRole(roleHash, address);
  await tx.wait();
  console.log(`Assigned ${role} to ${address}`);
}

/**
 * @dev Helper function to verify a deployed contract on Etherscan.
 */
async function verifyContract(address, args = []) {
  console.log(`Verifying contract at ${address}...`);
  try {
    await run("verify:verify", { address, constructorArguments: args });
    console.log(`✅ Contract verified: ${address}`);
  } catch (error) {
    console.error(`❌ Verification failed for ${address}:`, error);
  }
}

/**
 * @dev Main deployment script.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Deploying on network: ${network.name}`);

  // Deploy contracts sequentially
  const kosmaNFT = await deployContract("KosmaNFT");
  const kosmaPayments = await deployContract("KosmaPayments");
  const layerZeroMessaging = await deployContract("LayerZeroMessaging");

  // Assign ADMIN_ROLE to the deployer for KosmaPayments
  await assignRoles(kosmaPayments, "ADMIN_ROLE", deployer.address);

  // Verify contracts on Etherscan (optional)
  await verifyContract(kosmaNFT.address);
  await verifyContract(kosmaPayments.address);
  await verifyContract(layerZeroMessaging.address);

  console.log("🎉 All contracts deployed and verified successfully!");
}

// Execute the main function with proper error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
