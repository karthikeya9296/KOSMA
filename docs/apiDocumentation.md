# Kosma System Architecture

## Overview

Kosma is a decentralized social media platform designed to empower content creators by leveraging blockchain technology and innovative monetization models. Kosma allows users to own their content as NFTs, manage royalties, conduct cross-chain interactions, and handle encrypted communication. The system integrates multiple blockchain protocols, services, and APIs to ensure secure, transparent, and user-centric operations.

### High-Level System Diagram
The major components of Kosma are:

- **Frontend**: User interaction layer built with React.js, allowing users to mint NFTs, manage content, and make payments.
- **Backend**: Node.js and Express.js server that handles API requests, business logic, and connects to the blockchain.
- **Smart Contracts**: KosmaNFT.sol and KosmaPayments.sol manage NFT creation and payments. LayerZero enables cross-chain messaging.
- **Database**: MongoDB stores user profiles, NFT metadata, and transaction histories.

### System Components

#### Frontend
- **Tech Stack**: React.js, Tailwind CSS for styling, Axios for API calls, Web3.js for blockchain interactions, and Chart.js for displaying royalty earnings.
- **User Interactions**: Users can create and mint NFTs, purchase memberships, view earnings, and transfer NFTs cross-chain. The interface also allows users to manage their profile and view transaction history.

#### Backend
- **Tech Stack**: Node.js, Express.js, and MongoDB. The backend is responsible for handling user authentication, NFT minting, payments, and content management.
- **Responsibilities**: Connects to smart contracts using Web3.js and communicates with external APIs like Circle USDC and Superfluid for payments.

#### Blockchain Layer
- **Smart Contracts**:
  - **KosmaNFT.sol**: Handles minting and managing NFTs. 
  - **KosmaPayments.sol**: Manages payments including USDC tips and Superfluid streaming payments.
  - **FlowNFT.sol**: Manages NFTs on the Flow blockchain.
  - **StoryIntegration.sol**: Integrates Story Protocol for licensing and royalties.
  - **LayerZeroMessaging.sol**: Handles cross-chain NFT transfers using LayerZero’s omnichain messaging.

#### Cross-Chain Integration
Kosma leverages **LayerZero V2** for omnichain communication, enabling users to transfer NFTs and interact across Ethereum, Flow, and Polygon blockchains seamlessly.

#### Membership and Licensing
- **Unlock Protocol**: Manages NFT-based memberships, enabling content creators to offer exclusive access to fans.
- **Story Protocol**: Manages content licensing and royalties. Integrates dispute resolution for ownership issues.

### Data Flow

1. **Frontend**: Users create content and mint NFTs through a user-friendly React interface.
2. **Backend**: The backend processes user requests and interacts with the smart contracts using Web3.js or Ethers.js.
3. **Smart Contracts**: Minting, payments, and cross-chain transfers are handled by the respective smart contracts deployed on Ethereum, Polygon, or Flow.
4. **Database**: MongoDB stores metadata, transaction history, and user profiles.
5. **Blockchain**: Transactions are verified and recorded on-chain, ensuring transparency and security.

### Interactions Between Components

- **Smart Contracts and Backend**: Backend services interact with smart contracts for minting NFTs, handling payments, and verifying ownership using Web3.js.
- **The Graph**: Used to create subgraphs that index contract events for faster querying.
- **XMTP**: Handles secure, encrypted communication between users.

### Security Considerations

- **LedgerJS**: Provides hardware security integration for managing private keys and securing user assets.
- **Lit Protocol**: Encrypts sensitive user data such as payments and private messages.
- **Contract Security**: Kosma uses OpenZeppelin’s **AccessControl** for roles and **ReentrancyGuard** for preventing reentrancy attacks.

---

# Kosma API Documentation

## Overview

The Kosma API provides endpoints for developers and integrators to interact with Kosma’s decentralized social media platform. The API facilitates NFT minting, content management, payments, and memberships, all while interacting with various blockchain protocols and smart contracts.

### Authentication

Kosma's API requires **JWT** authentication. Upon logging in, you will receive a token that should be included in the `Authorization` header for all authenticated requests.

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
