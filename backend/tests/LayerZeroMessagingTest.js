const LayerZeroMessaging = artifacts.require("LayerZeroMessaging");

contract("LayerZeroMessaging", (accounts) => {
  let layerZeroMessaging;
  const [owner, user, recipient] = accounts;
  const destChainId = 101;
  const maxGasFee = web3.utils.toWei("0.1", "ether");

  before(async () => {
    const mockEndpoint = await artifacts.require("LayerZeroEndpointMock").new();
    layerZeroMessaging = await LayerZeroMessaging.new(mockEndpoint.address, { from: owner });
    await layerZeroMessaging.whitelistChain(destChainId, { from: owner });
  });

  it("should initiate a cross-chain NFT transfer", async () => {
    const mediaUri = "ipfs://example-media-uri";

    // Send gas fee to the user
    await web3.eth.sendTransaction({
      from: owner,
      to: user,
      value: web3.utils.toWei("1", "ether"),
    });

    // Initiate the transfer
    const result = await layerZeroMessaging.initiateTransfer(destChainId, recipient, mediaUri, maxGasFee, {
      from: user,
      value: maxGasFee,
    });

    // Check for the TransferInitiated event
    assert(result.logs[0].event === "TransferInitiated", "Expected TransferInitiated event");
    assert(result.logs[0].args.to === recipient, "Recipient mismatch");
  });
});
