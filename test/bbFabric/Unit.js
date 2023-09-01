const { ethers, network, upgrades } = require("hardhat");
const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");

describe("BBFabric unit test", function () {
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  let accounts;
  let bbFabric;
  let relayerAddress, perpImpl, aaveImpl, usdc, bridge;
  const NATIVE_CHAIN_ID = 1;
  before(async function () {
    accounts = await ethers.getSigners();
    relayerAddress = accounts[0];
    usdc = accounts[1];
    bridge = accounts[2];

    const bbFactory = await ethers.getContractFactory("BBMock");
    const bbFabricFactory = await ethers.getContractFactory("BBFabric");

    bbFabric = await bbFabricFactory.deploy(
      NATIVE_CHAIN_ID,
      relayerAddress.address
    );

    await bbFabric.connect(relayerAddress).setBridge(bridge.address);
    await bbFabric.connect(relayerAddress).setStable(usdc.address);

    perpImpl = await upgrades.deployBeacon(bbFactory);
    await perpImpl.deployed();
    aaveImpl = await upgrades.deployBeacon(bbFactory);
    await aaveImpl.deployed();
  });
  describe("Initialization", function () {
    let snapshotId;
    beforeEach(async function () {
      snapshotId = await network.provider.request({
        method: "evm_snapshot",
        params: [],
      });
    });

    afterEach(async function () {
      await network.provider.request({
        method: "evm_revert",
        params: [snapshotId],
      });
    });

    it("should successful initialize", async function () {
      const bbFabricFactory = await ethers.getContractFactory("BBFabric");
      const deployedFabricAddress = await bbFabricFactory.deploy(
        NATIVE_CHAIN_ID,
        relayerAddress.address
      );
      expect(deployedFabricAddress.address.toString()).not.equal(ZERO_ADDRESS);
    });

    it("should revert with nativeId is zero", async function () {
      const bbFabricFactory = await ethers.getContractFactory("BBFabric");
      await expectRevert(
        bbFabricFactory.deploy(0, relayerAddress.address),
        "BBFabric::constructor:nativeId is zero"
      );
    });

    it("should revert with relayer is zero address", async function () {
      const bbFabricFactory = await ethers.getContractFactory("BBFabric");
      await expectRevert(
        bbFabricFactory.deploy(NATIVE_CHAIN_ID, ZERO_ADDRESS),
        "BBFabric::constructor:relayer is zero address"
      );
    });
  });
  describe("Getters", function () {
    let snapshotId;
    beforeEach(async function () {
      snapshotId = await network.provider.request({
        method: "evm_snapshot",
        params: [],
      });
    });

    afterEach(async function () {
      await network.provider.request({
        method: "evm_revert",
        params: [snapshotId],
      });
    });
    it("should return native chain Id", async function () {
      const chainID = await bbFabric.nativeChainId();
      expect(chainID.toString()).to.be.equal(NATIVE_CHAIN_ID.toString());
    });
    it("should return nativeRouter", async function () {
      const chainID = await bbFabric.nativeChainId();
      expect(chainID.toString()).to.be.equal(NATIVE_CHAIN_ID.toString());
    });
    it("should return sgBridge", async function () {
      const bridgeAddr = await bbFabric.sgBridge();
      expect(bridgeAddr.toString()).to.be.equal(bridge.address);
    });
    it("should return currentUSDCToken", async function () {
      const token = await bbFabric.currentUSDCToken();
      expect(token.toString()).to.be.equal(usdc.address);
    });
    it("should return deCommasRelayerAddress", async function () {
      const relayerAdd = await bbFabric.deCommasRelayerAddress();
      expect(relayerAdd.toString()).to.be.equal(relayerAddress.address);
    });
  });
});
