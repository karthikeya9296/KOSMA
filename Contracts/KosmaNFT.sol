// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract KosmaNFT is ERC721URIStorage, Ownable, ReentrancyGuard, AccessControl, Initializable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    // Mapping of NFTs to their respective metadata
    mapping(uint256 => NFTMetadata) private nftMetadata;

    // Struct to hold NFT metadata
    struct NFTMetadata {
        string name;
        string description; // Consider storing off-chain for gas optimization
        string license; // Consider storing off-chain for gas optimization
        uint256 royaltyPercentage;
        address creator;
        bool isRoyaltyEnforced; // Flag to indicate if royalty enforcement is required
    }

    // Events
    event NFTMinted(uint256 indexed tokenId, address indexed creator);
    event NFTTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
    event RoyaltiesPaid(uint256 indexed tokenId, address indexed creator, uint256 amount);
    event NFTBurned(uint256 indexed tokenId);

    // Minting enabled flag
    bool public mintingEnabled = true;

    // Custom Errors for Gas Optimization
    error MintingDisabled();
    error UnauthorizedCreator();
    error InvalidRoyalty(uint256 maxRoyalty);
    error NotNFTOwner(address caller);
    error InvalidRecipientAddress();
    error InsufficientRoyalty(uint256 sentAmount, uint256 requiredAmount);

    // Constructor function
    constructor() ERC721("KosmaNFT", "KNFT") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender); // Grant the contract deployer the default admin role
    }

    // Function to initialize contract (for upgradeable proxy)
    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DAO_ROLE, msg.sender);
    }

    // Function to enable or disable minting
    function setMintingEnabled(bool enabled) public onlyRole(DAO_ROLE) {
        mintingEnabled = enabled;
    }

    // Function to mint an NFT
    function mintNFT(
        string memory _name,
        string memory _description,
        string memory _license,
        uint256 _royaltyPercentage,
        string memory _tokenURI,
        bool _isRoyaltyEnforced // New parameter for royalty enforcement
    ) public {
        if (!mintingEnabled) revert MintingDisabled();
        if (_royaltyPercentage > 30) revert InvalidRoyalty(30);
        if (!hasRole(CREATOR_ROLE, msg.sender)) revert UnauthorizedCreator();

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _mint(msg.sender, tokenId);

        nftMetadata[tokenId] = NFTMetadata(
            _name,
            _description,
            _license,
            _royaltyPercentage,
            msg.sender,
            _isRoyaltyEnforced
        );

        _setTokenURI(tokenId, _tokenURI);
        emit NFTMinted(tokenId, msg.sender);
    }

    // Internal function for royalty payment calculation
    function _calculateRoyalty(uint256 salePrice, uint256 royaltyPercentage) internal pure returns (uint256) {
        return (salePrice * royaltyPercentage) / 100;
    }

    // Function to transfer an NFT with royalty payment
    function safeTransferWithRoyalty(address to, uint256 tokenId, uint256 salePrice) public payable nonReentrant {
        if (ownerOf(tokenId) != msg.sender) revert NotNFTOwner(msg.sender);
        if (to == address(0)) revert InvalidRecipientAddress(); // Prevent transfers to zero address

        NFTMetadata memory metadata = nftMetadata[tokenId];

        if (metadata.isRoyaltyEnforced) {
            uint256 royaltyAmount = _calculateRoyalty(salePrice, metadata.royaltyPercentage);
            if (msg.value < royaltyAmount) revert InsufficientRoyalty(msg.value, royaltyAmount);

            // Pay the royalty to the creator
            payable(metadata.creator).transfer(royaltyAmount);

            // Refund any excess amount sent
            if (msg.value > royaltyAmount) {
                payable(msg.sender).transfer(msg.value - royaltyAmount);
            }
        }

        // Transfer the NFT
        safeTransferFrom(msg.sender, to, tokenId);
        emit NFTTransferred(tokenId, msg.sender, to);
    }

    // Function to allow users to burn their own NFTs
    function burnNFT(uint256 tokenId) public {
        if (ownerOf(tokenId) != msg.sender && msg.sender != owner()) revert NotNFTOwner(msg.sender);
        _burn(tokenId);
        delete nftMetadata[tokenId];
        emit NFTBurned(tokenId);
    }

    // Function to update NFT metadata
    function updateMetadata(uint256 tokenId, string memory newDescription, string memory newLicense) public {
        if (nftMetadata[tokenId].creator != msg.sender) revert UnauthorizedCreator();
        nftMetadata[tokenId].description = newDescription;
        nftMetadata[tokenId].license = newLicense;
    }

    // Function to get NFT metadata
    function getNFTMetadata(uint256 _tokenId)
        public
        view
        returns (
            string memory,
            string memory,
            string memory,
            uint256,
            address,
            bool
        )
    {
        NFTMetadata memory metadata = nftMetadata[_tokenId];
        return (
            metadata.name,
            metadata.description,
            metadata.license,
            metadata.royaltyPercentage,
            metadata.creator,
            metadata.isRoyaltyEnforced
        );
    }
}
