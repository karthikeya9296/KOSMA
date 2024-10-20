import NonFungibleToken from 0xf8d6e0586b0a20c7

pub contract KosmaNFT {

    // Struct to track privacy settings for user profiles
    pub struct PrivacySettings {
        pub let isWhitelisted: Bool

        init(isWhitelisted: Bool) {
            self.isWhitelisted = isWhitelisted
        }
    }

    // Resource that represents a User Profile
    pub resource Profile {
        pub let id: Address
        pub var privacySettings: PrivacySettings

        init(id: Address) {
            self.id = id
            self.privacySettings = PrivacySettings(isWhitelisted: false)
        }

        // Update privacy settings to whitelist a user
        pub fun updatePrivacy(isWhitelisted: Bool) {
            self.privacySettings = PrivacySettings(isWhitelisted: isWhitelisted)
        }
    }

    // Admin resource to manage user connections
    pub resource Admin {
        pub var whitelistedAccounts: {Address: Bool}

        init() {
            self.whitelistedAccounts = {}
        }

        // Add an address to the whitelist
        pub fun addToWhitelist(account: Address) {
            self.whitelistedAccounts[account] = true
        }

        // Remove an address from the whitelist
        pub fun removeFromWhitelist(account: Address) {
            self.whitelistedAccounts[account] = false
        }

        // Check if an address is whitelisted
        pub fun isWhitelisted(account: Address): Bool {
            return self.whitelistedAccounts[account] ?? false
        }
    }

    // Resource that represents an NFT with screenshot and unauthorized capture protection
    pub resource NFT {
        pub let id: UInt64
        pub let metadata: String
        pub var screenshotProtectionEnabled: Bool
        pub var infraredProtectionEnabled: Bool

        init(_id: UInt64, _metadata: String) {
            self.id = _id
            self.metadata = _metadata
            self.screenshotProtectionEnabled = true
            self.infraredProtectionEnabled = true
        }

        // Notify content creator if a screenshot attempt is made
        pub fun notifyScreenshotAttempt() {
            if self.screenshotProtectionEnabled {
                log("Screenshot attempt detected for NFT ID: ".concat(self.id.toString()))
            }
        }

        // Simulate infrared protection mechanism
        pub fun applyInfraredProtection() {
            if self.infraredProtectionEnabled {
                log("Infrared protection activated for NFT ID: ".concat(self.id.toString())
                    .concat(", content blurred to prevent unauthorized capture."))
            }
        }
    }

    // Resource interface for Collection
    pub resource interface CollectionPublic {
        pub fun deposit(token: @NFT)
        pub fun withdraw(withdrawID: UInt64): @NFT
        pub fun getIDs(): [UInt64]
        pub fun getNFT(id: UInt64): &NFT?
    }

    // Resource that represents a Collection of NFTs
    pub resource Collection: CollectionPublic {
        pub var ownedNFTs: @{UInt64: NFT}

        init() {
            self.ownedNFTs <- {}
        }

        // Deposit an NFT into the collection
        pub fun deposit(token: @NFT) {
            let id = token.id
            self.ownedNFTs[id] <-! token
        }

        // Withdraw an NFT from the collection by ID
        pub fun withdraw(withdrawID: UInt64): @NFT {
            let token <- self.ownedNFTs.remove(key: withdrawID) 
                ?? panic("NFT does not exist in this collection")
            return <- token
        }

        // Get a list of all NFT IDs in the collection
        pub fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        // Get a reference to an NFT by ID
        pub fun getNFT(id: UInt64): &NFT? {
            return &self.ownedNFTs[id] as &NFT?
        }

        destroy() {
            destroy self.ownedNFTs
        }
    }

    // Resource that is used to mint NFTs
    pub resource Minter {
        pub fun mintNFT(id: UInt64, metadata: String): @NFT {
            return <- create NFT(_id: id, _metadata: metadata)
        }
    }

    // Public function to create an empty collection
    pub fun createEmptyCollection(): @Collection {
        return <- create Collection()
    }

    // Public function to create a Profile resource
    pub fun createProfile(id: Address): @Profile {
        return <- create Profile(id: id)
    }

    // Public function to create an Admin resource
    pub fun createAdmin(): @Admin {
        return <- create Admin()
    }

    // The resource used to mint new NFTs
    pub let NFTMinter: @Minter

    // The admin resource to manage privacy settings
    pub let admin: @Admin

    // Initialize the contract
    init() {
        self.NFTMinter <- create Minter()
        self.admin <- create Admin()
    }

    // Destroy the contract resources
    destroy() {
        destroy self.NFTMinter
        destroy self.admin
    }
}