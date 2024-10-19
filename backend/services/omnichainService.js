const { ethers } = require('ethers');
const LayerZeroEndpoint = require('@layerzerolabs/LayerZeroEndpoint');

// Load your compiled LayerZeroMessaging.sol contract ABI and address
const LayerZeroMessagingABI = require('./abi/LayerZeroMessaging.json');
const contractAddress = "YOUR_CONTRACT_ADDRESS"; // Deployed LayerZeroMessaging.sol contract address

// Load provider and signer (Wallet)
const provider = new ethers.providers.JsonRpcProvider("RPC_PROVIDER_URL"); // RPC provider (Infura, Alchemy, etc.)
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider); // Replace with your private key

// Create contract instance
const layerZeroMessagingContract = new ethers.Contract(contractAddress, LayerZeroMessagingABI, signer);

// LayerZero Endpoint address and SDK initialization
const endpointAddress = 'LAYERZERO_ENDPOINT_ADDRESS'; // Replace with actual LayerZero endpoint address
const layerZeroEndpoint = new LayerZeroEndpoint(endpointAddress);

// Event listener for cross-chain events
const eventEmitter = layerZeroMessagingContract.connect(provider);

// Dynamic rate-limiting mechanism
const transferRequestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 60 seconds
const MAX_REQUESTS_PER_WINDOW = 5; // Max requests per minute

function rateLimitCheck(address) {
    const now = Date.now();
    if (!transferRequestCounts.has(address)) {
        transferRequestCounts.set(address, []);
    }

    const timestamps = transferRequestCounts.get(address).filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
        throw new Error('Rate limit exceeded. Try again later.');
    }

    timestamps.push(now);
    transferRequestCounts.set(address, timestamps);
}

// Retry logic with exponential backoff
async function retryTransaction(txFunction, maxRetries = 3, delay = 2000) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            return await txFunction();
        } catch (error) {
            attempts++;
            if (attempts === maxRetries) throw new Error(`Transaction failed after ${attempts} attempts: ${error.message}`);
            console.log(`Retry attempt ${attempts}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Initiate Cross-Chain NFT Transfer
async function initiateNFTTransfer(destChainId, to, tokenId, maxGasFee) {
    try {
        rateLimitCheck(signer.address);

        // Validate gas fee input
        if (!ethers.utils.isHexString(maxGasFee)) {
            throw new Error('Invalid gas fee value.');
        }

        const gasFee = ethers.utils.parseEther(maxGasFee.toString()); // Ensure BigNumber precision for gas fee

        const tx = await retryTransaction(() =>
            layerZeroMessagingContract.initiateTransfer(destChainId, to, tokenId, gasFee, { value: gasFee })
        );

        console.log(`NFT transfer initiated. Transaction hash: ${tx.hash}`);
        await tx.wait(); // Wait for the transaction to complete
        console.log('NFT transfer completed.');
        return tx;
    } catch (error) {
        console.error(`Error initiating NFT transfer: ${error.message}`);
        throw error;
    }
}

// Handle receiving cross-chain messages
async function lzReceive(srcChainId, payload, signature) {
    try {
        // Verify the signature
        const recoveredSigner = ethers.utils.verifyMessage(payload, signature);
        const isAdmin = await layerZeroMessagingContract.hasRole(ethers.utils.id('ADMIN_ROLE'), recoveredSigner);

        if (!isAdmin) throw new Error("Unauthorized signer for the message");

        // Decode the payload
        const { owner, to, tokenId } = ethers.utils.defaultAbiCoder.decode(['address', 'address', 'uint256'], payload);

        // Validate the decoded data
        if (!ethers.utils.isAddress(to)) throw new Error('Invalid recipient address.');
        if (!Number.isInteger(tokenId) || tokenId <= 0) throw new Error('Invalid token ID.');

        // Process the cross-chain message and mint the NFT on the new chain
        const tx = await layerZeroMessagingContract.lzReceive(srcChainId, payload, signature);
        await tx.wait(); // Wait for the transaction to complete
        console.log(`Cross-chain NFT transfer completed for token ${tokenId}`);
        return tx;
    } catch (error) {
        console.error(`Error processing cross-chain message: ${error.message}`);
        throw error;
    }
}

// Monitor contract events for cross-chain messaging
async function monitorEvents() {
    try {
        eventEmitter.on("TransferInitiated", async (from, to, tokenId, destChainId) => {
            try {
                console.log({
                    event: 'TransferInitiated',
                    from,
                    to,
                    tokenId,
                    destChainId,
                    timestamp: new Date().toISOString(),
                });
            } catch (error) {
                console.error(`Error handling TransferInitiated event: ${error.message}`);
            }
        });

        eventEmitter.on("TransferCompleted", async (owner, tokenId, srcChainId) => {
            try {
                console.log({
                    event: 'TransferCompleted',
                    owner,
                    tokenId,
                    srcChainId,
                    timestamp: new Date().toISOString(),
                });
            } catch (error) {
                console.error(`Error handling TransferCompleted event: ${error.message}`);
            }
        });

        eventEmitter.on("FailedTransfer", async (owner, tokenId, srcChainId, reason) => {
            try {
                console.error({
                    event: 'FailedTransfer',
                    owner,
                    tokenId,
                    srcChainId,
                    reason,
                    timestamp: new Date().toISOString(),
                });
            } catch (error) {
                console.error(`Error handling FailedTransfer event: ${error.message}`);
            }
        });
    } catch (error) {
        console.error(`Error monitoring contract events: ${error.message}`);
        throw error;
    }
}

// Verify Cross-Chain Messages (Authenticity check)
async function verifyMessage(message, signature) {
    try {
        const recoveredSigner = ethers.utils.verifyMessage(message, signature);
        const isAdmin = await layerZeroMessagingContract.hasRole(ethers.utils.id('ADMIN_ROLE'), recoveredSigner);
        if (!isAdmin) throw new Error('Message verification failed: unauthorized signer');
        return isAdmin;
    } catch (error) {
        console.error(`Message verification failed: ${error.message}`);
        return false;
    }
}

// Start the omnichain service
async function startService() {
    console.log("Starting Omnichain Service for cross-chain messaging and NFT transfers...");
    await monitorEvents();
}

// Export functions
module.exports = {
    initiateNFTTransfer,
    lzReceive,
    verifyMessage,
    startService,
};
