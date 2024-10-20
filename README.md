# Kosma Decentralized Social Media Platform

Kosma is a decentralized social media platform that aims to provide a secure, non-invasive, privacy-centric alternative to current social networks. By leveraging blockchain technology, Kosma gives users control over their data, content, and monetization options, while ensuring cross-chain compatibility and efficient content licensing.

## Table of Contents

- [Project Overview](#project-overview)
- [Technologies Used](#technologies-used)
- [Core Features](#core-features)
- [System Architecture](#system-architecture)
- [Frontend Modules](#frontend-modules)
- [Backend Modules](#backend-modules)
- [Smart Contracts](#smart-contracts)
- [Deployment](#deployment)
- [Installation and Setup](#installation-and-setup)
- [Usage](#usage)
- [Contribution Guidelines](#contribution-guidelines)
- [License](#license)

## Project Overview

Kosma aims to disrupt the current social media landscape by prioritizing user privacy, non-addictive content consumption, and transparent monetization. It enables users to securely interact, create content, mint NFTs, license their work, and communicate across different blockchain networks. The platform offers seamless cross-chain interactions and privacy-centric features by integrating multiple blockchain tools and services.

## Technologies Used

- **Solidity**: Smart contract development for NFT minting, payments, attestations, etc.
- **Flow Blockchain**: (#Integration with Flow)(/Users/karthik/KOSMA/README.md
/Users/karthik/KOSMA/Contracts/KosmaNFT.cdc)

Kosma utilizes Flow blockchain's native smart contract language, Cadence, to manage NFTs representing user-generated content. This integration leverages Flow’s account abstraction and resource-oriented model to ensure scalability and user-friendly experiences. Flow is used to:

Manage user privacy settings.

Enable secure content minting as NFTs.

Prevent unauthorized content capture through layered protections.

- **LayerZero V2**: Cross-chain messaging and NFT interactions.
- **Story Protocol**: Content licensing, royalty, and dispute management.(add hyperlink for /Users/karthik/KOSMA/backend/services/storyService.js )
Integration with Story Protocol

KOSMA leverages Story Protocol's powerful blockchain tools to provide a comprehensive solution for creative content management. The integration is as follows:

Licensing: Using the Story Protocol SDK, KOSMA allows content creators to issue licenses to others for using their IP, ensuring transparent and programmable licensing agreements.

Royalties: With Story Protocol's royalty management API, royalties are seamlessly distributed to relevant parties whenever the licensed content is used, enhancing the transparency and fairness of royalty payments.

Disputes: The dispute resolution smart contracts provided by Story Protocol are utilized to address any conflicts that arise over creative IP, giving creators and licensees a fair process to resolve disputes.
- **Sign Protocol**: Attestations for content ownership, licensing, and user verification.
- **Superfluid**: Streaming payments for subscriptions and royalty payments.
- **Circle USDC**: Stablecoin payments.
- **XMTP**: Secure on-chain messaging for comments and notifications.
- **Unlock Protocol**: Membership management for premium content.
- **React.js**: Frontend UI components.
- **Node.js/Express**: Backend APIs to interact with the blockchain.
- **MongoDB**: Metadata storage and user management.

## Core Features

- **NFT Minting and Royalty Management**: Users can mint NFTs representing their content and specify royalty percentages.
- **Content Licensing**: Implemented via Story Protocol, enabling secure and clear licensing agreements.
- **Membership and Exclusive Content**: Managed through Unlock Protocol, offering multiple membership tiers.
- **Streaming Payments**: Leveraging Superfluid for continuous payments for licensed content.
- **Cross-Chain Compatibility**: LayerZero V2 for transferring NFTs and messages across blockchain networks.
- **Secure Messaging and Encryption**: Using XMTP and Lit Protocol for encrypted notifications and secure messaging.
- **AI-Powered Content Generation**: AI tools integrated for generating captions, text, and other creative content.

## System Architecture

The platform is divided into the following major components:

- **Smart Contracts**: Written in Solidity, these handle NFT minting, licensing, attestations, royalty distribution, and payments.
- **Backend Services**: A Node.js/Express server that handles API requests, blockchain interactions, and database management.
- **Frontend Application**: A React.js application for user interactions, content consumption, and wallet integration.
- **Database**: MongoDB used for storing metadata about users, content, transactions, and profiles.

For detailed system architecture, refer to the documentation available in the `/docs/systemArchitecture.md` file.

## Frontend Modules

### Components

- **Navbar.js**: Main navigation menu, integrates with LedgerJS for wallet connections.
- **ContentCard.js**: Displays user-generated content, including options for liking, sharing, and licensing.
- **MembershipCard.js**: Shows membership details and allows users to purchase memberships via Unlock Protocol.
- **PaymentForm.js**: Manages all payments, including tips, content purchases, and streaming subscriptions.
- **LedgerConnect.js**: Facilitates connecting to the Ledger wallet for transactions.

### Pages

- **HomePage.js**: Displays trending content, sports engagement, and recommended creators.
- **ProfilePage.js**: Provides an overview of a user's content, NFTs, and memberships.
- **ContentPage.js**: Shows detailed content view, including licensing options and cross-chain interactions.

## Backend Modules

- **app.js**: Main backend server, runs using Node.js/Express.
- **routes/**: Includes different API endpoints for handling user authentication, NFT minting, payments, attestations, etc.
- **services/**: Connects the backend to the blockchain for operations such as payments, attestations, and cross-chain messaging.
- **middlewares/**: Security and verification middleware for handling user authentication and blockchain interactions.

## Smart Contracts

- **KosmaNFT.sol**: Handles NFT minting, royalty distribution, and licensing management .
- **LayerZeroMessaging.sol**: Facilitates cross-chain messaging using LayerZero V2.
- **SignAttestations.sol**: Uses Sign Protocol to manage attestations for ownership, licensing, and verification.
- **StoryIntegration.sol**: Manages content licensing, royalties, and disputes using Story Protocol.
- **KosmaPayments.sol**: Handles payments using Circle USDC and Superfluid for streaming.
- **UnlockMemberships.sol**: Manages memberships for premium content using Unlock Protocol.

## Deployment

### Contracts Deployment:
Smart contracts are deployed using **Truffle** or **Hardhat**.

### Frontend Deployment:
The frontend is deployed to a hosting service using `deployFrontend.sh`.

### Subgraph Creation:
Use `/scripts/createSubgraph.js` to create a subgraph for indexing data using **The Graph**.

## Installation and Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/yourusername/kosma.git
   cd kosma
2. **Install Dependencies:**
    ```bash
    npm install
3. **Environment Configuration: Copy .env.example to .env and fill in the necessary credentials and blockchain keys.**
4. **Start Backend Server:**
    ```bash
    npm run start-backend
5. **Start Frontend Application:**
    ```bash
    npm run start-frontend
6. **Deploy Smart Contracts: Follow the steps in /docs/deploymentGuide.md to deploy contracts.**

## Usage
1. Connect Wallet: Connect your Ledger wallet using the Navbar.
2. Mint NFTs: Use the profile page to create NFTs for your content.
3. License Content: View and set licensing terms on the content page.
Join Memberships: Purchase memberships using Unlock Protocol to access exclusive content.

## Contribution Guidelines
We welcome contributions to Kosma! Please follow these steps:

Fork the Repository: Fork and clone the repository to your local machine.
Create a Feature Branch: Create a branch for your feature or bug fix.
Commit Your Changes: Make sure to add detailed commit messages.
Push to Your Branch: Push your branch to your fork.
Open a Pull Request: Open a pull request against the main repository.
For detailed contribution guidelines, see /docs/developmentGuidelines.md.

## License

Kosma is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

### Acknowledgments

- We would like to thank the developers and contributors of the libraries and protocols used in this project.
- Special thanks to the open-source community for their continuous support and contributions.

### Contact

For any inquiries or feedback, please reach out to us at [contact@kosma.com](mailto:contact@kosma.com).