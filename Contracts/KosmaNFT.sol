// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "layerzero/contracts/LayerZeroEndpoint.sol";
import "storyprotocol/contracts/StoryProtocol.sol";

contract KosmaNFT is ERC721URIStorage, AccessControl, ReentrancyGuard, Initializable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct RoyaltyInfo {
        address[] creators;
        uint256[] royaltyPercentages;
        uint256 nextAllowedUpdate;
    }

    struct LicenseInfo {
        address licensee;
        uint256 licenseFee;
        uint256 expirationDate;
        string usageRights;
    }

    IERC20 public immutable usdcToken; // Immutable to save gas
    LayerZeroEndpoint public immutable layerZeroEndpoint; // Immutable for cross-chain use
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    mapping(uint256 => RoyaltyInfo) public royalties;
    mapping(uint256 => LicenseInfo[]) public licenses;
    mapping(uint256 => string) public metadataHashes;
    uint256 public mintingFee;

    event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI, uint256[] royaltyPercentages);
    event RoyaltyPaid(address indexed creator, uint256 indexed tokenId, uint256 amount);
    event ContentLicensed(address indexed licensee, uint256 indexed tokenId, uint256 fee, string usageRights);
    event NFTTransferredCrossChain(uint256 indexed tokenId, address indexed owner, string destinationChain);
    event RoyaltyUpdated(uint256 indexed tokenId, uint256[] newRoyaltyPercentages);
    event LicenseTermsSet(uint256 indexed tokenId, string licenseTerms);

    constructor(address _usdcTokenAddress, address _layerZeroEndpointAddress) ERC721("KosmaNFT", "KNFT") {
        usdcToken = IERC20(_usdcTokenAddress);
        layerZeroEndpoint = LayerZeroEndpoint(_layerZeroEndpointAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    modifier onlyOwnerOrCreator(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        _;
    }

    function setMintingFee(uint256 _fee) external onlyRole(ADMIN_ROLE) {
        mintingFee = _fee;
    }

    function mintNFT(
        string memory title,
        string memory description,
        string memory tokenURI,
        string memory metadataHash,
        address[] memory creators,
        uint256[] memory royaltyPercentages
    ) external payable nonReentrant {
        require(msg.value == mintingFee, "Incorrect minting fee");
        require(creators.length == royaltyPercentages.length, "Creators and royalties length mismatch");
        require(_validRoyalty(royaltyPercentages), "Invalid royalty values");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, tokenURI);
        metadataHashes[newItemId] = metadataHash;

        royalties[newItemId] = RoyaltyInfo({
            creators: creators,
            royaltyPercentages: royaltyPercentages,
            nextAllowedUpdate: block.timestamp + 30 days
        });

        emit NFTMinted(newItemId, msg.sender, tokenURI, royaltyPercentages);
    }

    function _validRoyalty(uint256[] memory royaltyPercentages) internal pure returns (bool) {
        uint256 totalRoyalty;
        for (uint256 i = 0; i < royaltyPercentages.length; i++) {
            totalRoyalty += royaltyPercentages[i];
        }
        return totalRoyalty <= 100;
    }

    function distributeRoyalty(uint256 tokenId, uint256 salePrice) external nonReentrant {
        RoyaltyInfo memory royalty = royalties[tokenId];
        for (uint256 i = 0; i < royalty.creators.length; i++) {
            uint256 royaltyAmount = (salePrice * royalty.royaltyPercentages[i]) / 100;
            require(usdcToken.transferFrom(msg.sender, royalty.creators[i], royaltyAmount), "Royalty payment failed");
            emit RoyaltyPaid(royalty.creators[i], tokenId, royaltyAmount);
        }
    }

    function updateRoyalty(uint256 tokenId, uint256[] memory newRoyaltyPercentages) external onlyOwnerOrCreator(tokenId) nonReentrant {
        require(_validRoyalty(newRoyaltyPercentages), "Invalid royalty values");
        require(block.timestamp > royalties[tokenId].nextAllowedUpdate, "Royalty update cooldown period active");

        royalties[tokenId].royaltyPercentages = newRoyaltyPercentages;
        royalties[tokenId].nextAllowedUpdate = block.timestamp + 30 days;

        emit RoyaltyUpdated(tokenId, newRoyaltyPercentages);
    }

    function licenseContent(
        uint256 tokenId,
        uint256 fee,
        uint256 duration,
        string memory usageRights
    ) external nonReentrant {
        require(ownerOf(tokenId) != msg.sender, "Cannot license your own content");

        LicenseInfo memory licenseInfo = LicenseInfo({
            licensee: msg.sender,
            licenseFee: fee,
            expirationDate: block.timestamp + duration,
            usageRights: usageRights
        });

        licenses[tokenId].push(licenseInfo);
        require(usdcToken.transferFrom(msg.sender, royalties[tokenId].creators[0], fee), "License fee payment failed");

        emit ContentLicensed(msg.sender, tokenId, fee, usageRights);
    }

    function getLicenses(uint256 tokenId) external view returns (LicenseInfo[] memory) {
        return licenses[tokenId];
    }

    function transferNFTCrossChain(uint256 tokenId, string memory destinationChain) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "You are not the owner of this NFT");

        _burn(tokenId);
        layerZeroEndpoint.send(destinationChain, msg.sender, tokenId);

        emit NFTTransferredCrossChain(tokenId, msg.sender, destinationChain);
    }

    function validateMetadata(uint256 tokenId, string memory metadataHash) external view returns (bool) {
        return keccak256(abi.encodePacked(metadataHashes[tokenId])) == keccak256(abi.encodePacked(metadataHash));
    }

    function setLicenseTerms(uint256 tokenId, string memory licenseTerms) external onlyOwnerOrCreator(tokenId) {
        emit LicenseTermsSet(tokenId, licenseTerms);
    }
}
