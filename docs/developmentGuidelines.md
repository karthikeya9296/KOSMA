# Kosma Development Guidelines

## Project Overview

Kosma is a decentralized social media platform designed to give content creators full control over their work through NFT ownership, royalty management, and decentralized monetization. It uses blockchain technologies such as Ethereum, Flow, and Polygon to manage cross-chain interactions. The project integrates several protocols such as Story Protocol, LayerZero, and Unlock Protocol to provide licensing, memberships, and cross-chain NFT transfers. Kosma aims to build a secure, transparent, and user-centric platform for creators.

### Technologies Used:
- **Frontend**: React.js, Tailwind CSS, Axios, Chart.js, Web3.js.
- **Backend**: Node.js, Express.js, MongoDB.
- **Smart Contracts**: Solidity for Ethereum and Polygon, Cadence for Flow.
- **Blockchain Protocols**: LayerZero, Story Protocol, Unlock Protocol.

---

## Repository Structure

Here’s an overview of Kosma’s repository structure to help navigate the codebase.

```plaintext
kosma/
│
├── contracts/               # Smart contracts for NFT and payment management
│   ├── KosmaNFT.sol         # NFT contract for Ethereum and Polygon
│   ├── FlowNFT.sol          # NFT contract for Flow blockchain
│   ├── KosmaPayments.sol    # Manages payments using USDC and Superfluid
│   ├── LayerZeroMessaging.sol # Cross-chain messaging using LayerZero
│   └── StoryIntegration.sol # Licensing and royalty management using Story Protocol
│
├── backend/                 # Backend services written in Node.js
│   ├── app.js               # Main backend application file (Node.js/Express)
│   ├── routes/              # API routes (auth, content, payments, NFTs, memberships)
│   ├── services/            # Backend business logic (blockchain interactions, payments)
│   └── dbConfig.js          # Database configuration for MongoDB
│
├── frontend/                # Frontend web application using React.js
│   ├── src/                 # React source files (components, pages, services)
│   ├── public/              # Public assets like images, icons, etc.
│   └── App.js               # Main React component
│
├── scripts/                 # Deployment and automation scripts
│   ├── deployContracts.js   # Script for deploying smart contracts
│   └── deployFrontend.sh    # Script for deploying the frontend
│
├── docs/                    # Documentation files
│   └── systemArchitecture.md # System architecture documentation
├── .env                     # Environment variables file (keys, DB credentials)
├── README.md                # General project overview and instructions
└── package.json             # Node.js project configuration


Development Environment Setup
Prerequisites
Node.js (v14+)
MongoDB
Solidity (Truffle or Hardhat for testing)
Metamask for Web3 interactions

Coding Standards
Frontend (React.js)
State Management: Use React hooks for local state management, and Redux or Context API for global state.
Component Structure: Break components into reusable, self-contained units.
Styling: Use Tailwind CSS for consistency across the UI.
Linting: Use ESLint to catch errors and ensure consistent coding style.
Formatting: Use Prettier to auto-format code before committing.
Backend (Node.js/Express)
Controller-Services Pattern: Separate route handling from business logic. Use controllers for handling requests and services for business logic.
Security: Always validate input using middleware like express-validator. Ensure routes are protected by JWT authentication.
Error Handling: Use a central error handling middleware to capture all exceptions.
Smart Contracts (Solidity)
Security: Always follow OpenZeppelin’s best practices for security, such as using AccessControl and ReentrancyGuard.
Gas Optimization: Optimize contracts for lower gas fees by reducing storage operations and using smaller data types.
Testing: Write unit tests for smart contracts using Hardhat or Truffle.
Branching Strategy
We use GitFlow to manage branches efficiently:

main: The main production branch. Only fully tested and approved features are merged here.
develop: The integration branch for features. All new features are merged here before going to main.
feature/: Use feature branches for new developments. Once the feature is complete, merge it into develop.
hotfix/: Use hotfix branches for urgent fixes on the main branch.
Pull Request Guidelines
When opening a pull request (PR):

Write a clear and descriptive title.
Include a summary of what the PR does and why.
Ensure that the PR is linked to an issue (if applicable).
Test locally before submitting the PR.
Get your PR reviewed and approved by at least one other developer before merging.
Testing
Backend Testing
Tools: Mocha and Chai for unit tests.
Coverage: Ensure at least 80% code coverage for all routes and services.

Smart Contract Testing
Tools: Truffle or Hardhat.
Gas Usage: Ensure contracts are gas-efficient.
Security Tests: Test for reentrancy attacks, role-based access control, and malicious input.

Security and Secrets
Environment Variables: Store all secrets (e.g., API keys, private keys, database URIs) in a .env file. Never commit secrets to version control.
git-secrets: Use tools like git-secrets to ensure API keys or sensitive information are not accidentally pushed to the repository.

You can configure the deployment target (e.g., Netlify, Vercel) in the shell script.

CI/CD
We use GitHub Actions for continuous integration and deployment. Every pull request triggers automated tests and a build process. Ensure all tests pass before merging.

Contribution Guidelines
Issues: If you find a bug or want to request a feature, open an issue in GitHub and describe the problem or request clearly.
Significant Changes: Before making any significant changes, raise an issue and get approval from the maintainers.
Fork & Pull: Fork the repository, create a feature branch, and open a pull request when your changes are ready.
Code Review Process
When reviewing a pull request:

Ensure the code follows the coding standards.
Check that the tests pass and cover all the new features.
Verify that there are no security vulnerabilities (e.g., API keys in the code).
Review the efficiency of smart contracts, ensuring they are gas-optimized.
Leave constructive feedback on what can be improved.
Once the PR meets the above criteria, approve and merge the request.