// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract FlowNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct RoyaltyInfo {
        address creator;
        uint256 royaltyPercentage; // royalty percentage in basis points (100 = 1%)
    }

    // Mapping from token ID to royalty information
    mapping(uint256 => RoyaltyInfo) public royaltyInfo;

    // Event emitted when a new NFT is minted
    event NFTMinted(uint256 tokenId, address owner, string tokenURI);

    // Event emitted when royalties are paid
    event RoyaltiesPaid(address creator, uint256 amount);

    constructor() ERC721("KosmaFlowNFT", "KOSMA") {}

    // Function to mint a new NFT
    function mintNFT(address recipient, string memory tokenURI, uint256 royaltyPercentage) public onlyOwner returns (uint256) {
        require(royaltyPercentage <= 10000, "Royalty percentage too high"); // max 100% (in basis points)

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        
        // Mint the NFT
        _mint(recipient, newItemId);
        _setTokenURI(newItemId, tokenURI);

        // Set royalty info
        royaltyInfo[newItemId] = RoyaltyInfo({
            creator: recipient,
            royaltyPercentage: royaltyPercentage
        });

        emit NFTMinted(newItemId, recipient, tokenURI);
        return newItemId;
    }

    // Function to transfer NFT and handle royalty payment
    function transferNFT(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not owner nor approved");

        // Get royalty information
        RoyaltyInfo memory royalty = royaltyInfo[tokenId];

        if (royalty.royaltyPercentage > 0) {
            uint256 salePrice = msg.value; // Assuming transfer happens with some payment
            uint256 royaltyAmount = (salePrice * royalty.royaltyPercentage) / 10000;
            
            // Pay royalty to the creator
            payable(royalty.creator).transfer(royaltyAmount);
            emit RoyaltiesPaid(royalty.creator, royaltyAmount);
        }

        // Transfer the NFT
        _transfer(from, to, tokenId);
    }

    // Function to update metadata of an NFT (if needed)
    function updateMetadata(uint256 tokenId, string memory newTokenURI) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not owner nor approved");
        _setTokenURI(tokenId, newTokenURI);
    }

    // Function to burn an NFT
    function burnNFT(uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not owner nor approved");
        _burn(tokenId);
    }

    // Function to get the royalty info of an NFT
    function getRoyaltyInfo(uint256 tokenId) public view returns (address, uint256) {
        RoyaltyInfo memory royalty = royaltyInfo[tokenId];
        return (royalty.creator, royalty.royaltyPercentage);
    }

    // Function to get the current token ID
    function currentTokenId() public view returns (uint256) {
        return _tokenIds.current();
    }
}
