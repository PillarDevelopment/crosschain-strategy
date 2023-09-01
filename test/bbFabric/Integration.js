const { ethers, network, upgrades } = require("hardhat");
const { expect } = require("chai");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expectRevert } = require("@openzeppelin/test-helpers");

describe("BBFabric integration test", function () {
  let accounts;
  let bbFabric;
  let relayerAddress, dcRouter, perpImpl, aaveImpl, usdc, fakeRelayer, promoBB;
  const NATIVE_CHAIN_ID = 1;
  const ZERO_STR_ID = "0";
  before(async function () {
    accounts = await ethers.getSigners();
    relayerAddress = accounts[0];
    usdc = accounts[1];
    fakeRelayer = accounts[2];
    dcRouter = accounts[3];

    const bbFactory = await ethers.getContractFactory("BBMock");
    const bbFabricFactory = await ethers.getContractFactory("BBFabric");

    bbFabric = await bbFabricFactory.deploy(
      NATIVE_CHAIN_ID,
      relayerAddress.address
    );

    perpImpl = await upgrades.deployBeacon(bbFactory);
    await perpImpl.deployed();
    aaveImpl = await upgrades.deployBeacon(bbFactory);
    await aaveImpl.deployed();

    promoBB = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint16", "address"],
      [relayerAddress.address, usdc.address, NATIVE_CHAIN_ID, dcRouter.address]
    );
    const strId = "666";
    await expect(
      bbFabric
        .connect(relayerAddress)
        .initNewProxy(strId, perpImpl.address, promoBB)
    )
      .to.emit(bbFabric, "NewBBCreated")
      .withArgs(
        strId,
        perpImpl.address,
        "0x0B3463c91F71beB2872e8880455753Fbe26faCd5",
        "0x"
      );
  });
  describe("Init new Proxy BB", function () {
    let snapshotId;
    const strId = "777";
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
    it("should init new proxy", async function () {
      const initParams = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint16", "address"],
        [
          relayerAddress.address,
          usdc.address,
          NATIVE_CHAIN_ID,
          dcRouter.address,
        ]
      );
      await expect(
        bbFabric
          .connect(relayerAddress)
          .initNewProxy(strId, perpImpl.address, initParams)
      )
        .to.emit(bbFabric, "NewBBCreated")
        .withArgs(
          strId,
          perpImpl.address,
          "0x6AfaF4feDB927f92eCB4faEf08EDAfDF85E46f96",
          "0x"
        );
      const newProxyAddress = await bbFabric.getProxyAddressToId("1");
      expect(newProxyAddress.toString()).not.equal(ZERO_ADDRESS.address);
      const newImplAddr = await bbFabric.getImplToProxyAddress(newProxyAddress);
      expect(newImplAddr.toString()).to.be.equal(perpImpl.address);
      const newStrategyId = await bbFabric.getStrategyIdToProxyAddress(
        newProxyAddress
      );
      expect(newStrategyId.toString()).to.be.equal("777");
    });
    it("should revert with local call fail", async function () {
      const initParams = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint16"],
        [relayerAddress.address, 1]
      );
      await expectRevert(
        bbFabric
          .connect(relayerAddress)
          .initNewProxy(strId, perpImpl.address, initParams),
        "BBFabric:local call fail"
      );
    });
    it("should revert with only Relayer", async function () {
      const initParams = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint16", "address"],
        [
          relayerAddress.address,
          usdc.address,
          NATIVE_CHAIN_ID,
          dcRouter.address,
        ]
      );
      await expectRevert(
        bbFabric
          .connect(fakeRelayer)
          .initNewProxy(strId, perpImpl.address, initParams),
        "BaseAppStorage:Only relayer"
      );
    });
    it("should revert with ERC1967: new implementation is not a contract", async function () {
      const initParams = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint16", "address"],
        [
          relayerAddress.address,
          usdc.address,
          NATIVE_CHAIN_ID,
          dcRouter.address,
        ]
      );
      await expectRevert(
        bbFabric
          .connect(relayerAddress)
          .initNewProxy(strId, ZERO_ADDRESS, initParams),
        "ERC1967: new beacon is not a contract"
      );
    });
    it("should revert with revertMsg", async function () {
      const initParams = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint16", "address"],
        [ZERO_ADDRESS, usdc.address, NATIVE_CHAIN_ID, dcRouter.address]
      );
      await expectRevert(
        bbFabric
          .connect(relayerAddress)
          .initNewProxy(strId, perpImpl.address, initParams),
        "BBMock::initialize:relayer zero address"
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
    it("should return proxy Address", async function () {
      const newProxyAddress = await bbFabric.getProxyAddressToId(ZERO_STR_ID);
      expect(newProxyAddress.toString()).not.equal(ZERO_ADDRESS.address);
    });
    it("should return implementation Address", async function () {
      const newProxyAddress = await bbFabric.getProxyAddressToId(ZERO_STR_ID);
      const newImplAddr = await bbFabric.getImplToProxyAddress(newProxyAddress);
      expect(newImplAddr.toString()).to.be.equal(perpImpl.address);
    });
    it("should return strategy Id", async function () {
      const newProxyAddress = await bbFabric.getProxyAddressToId(ZERO_STR_ID);
      const newStrategyId = await bbFabric.getStrategyIdToProxyAddress(
        newProxyAddress
      );
      expect(newStrategyId.toString()).to.be.equal("666");
    });
    it("should return all bb data", async function () {
      const allData = await bbFabric.getAllBbData();
      expect(allData.toString()).to.be.equal(
        "666,0x22753E4264FDDc6181dc7cce468904A80a363E44,0x0B3463c91F71beB2872e8880455753Fbe26faCd5"
      );
    });
  });
});
