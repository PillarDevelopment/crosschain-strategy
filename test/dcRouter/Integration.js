const { ethers, network, waffle } = require("hardhat");
const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const userDeposit = "100000000";
const zeroAmount = "0";
const strategyId = "111";
const NATIVE_CHAIN_ID = "1";
const WITHDRAW_ALL = ethers.constants.MaxUint256;
const toWei = ethers.utils.parseEther;
const provider = waffle.provider;

describe("DcRouter integration test", function () {
  let accounts;
  let dcRouter;
  let usdc, usdt, failERC20;
  let relayerAddress, sgBridgeMock;
  let deployer;
  let userWallet, userWallet2;
  let bbMock;

  before(async function () {
    accounts = await ethers.getSigners();
    deployer = accounts[0];
    userWallet = accounts[1];
    userWallet2 = accounts[2];
    bbMock = accounts[3];
    relayerAddress = accounts[4];

    const tokenFactory = await ethers.getContractFactory("ERC20Mock");
    const dcRouterFactory = await ethers.getContractFactory("DcRouter");
    const bridgeFactory = await ethers.getContractFactory("StargateMock");
    const failedUSDCFactory = await ethers.getContractFactory(
      "BLOCKEDUSDCMock"
    );

    usdc = await tokenFactory.deploy("usdc");
    usdt = await tokenFactory.deploy("usdt");
    failERC20 = await failedUSDCFactory.deploy();

    dcRouter = await dcRouterFactory.deploy(
      relayerAddress.address,
      deployer.address,
      usdc.address,
      NATIVE_CHAIN_ID
    );
    sgBridgeMock = await bridgeFactory.deploy();
    await dcRouter.connect(relayerAddress).setBridge(sgBridgeMock.address);
    await usdc.mint(userWallet.address, userDeposit);
    await usdc.mint(userWallet2.address, userDeposit);
    await usdc.connect(userWallet).approve(dcRouter.address, userDeposit);
  });

  describe("dcRouter's getters", function () {
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
    it("should return pendingStrategyDeposits", async function () {
      expect(
        (await dcRouter.pendingStrategyDeposits(strategyId)).toString()
      ).to.equal(zeroAmount);
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);
      expect(
        (await dcRouter.pendingStrategyDeposits(strategyId)).toString()
      ).to.equal(userDeposit);
    });

    it("should return pendingStrategyWithdrawals", async function () {
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);

      expect(
        (await dcRouter.pendingStrategyWithdrawals(strategyId)).toString()
      ).to.equal(zeroAmount);
      await dcRouter
        .connect(userWallet)
        .initiateWithdraw(strategyId, userDeposit);
      expect(
        (await dcRouter.pendingStrategyWithdrawals(strategyId)).toString()
      ).to.equal(userDeposit);
    });

    it("should return correct pendingStrategyWithdrawals on full withdraw", async function () {
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);

      expect(
        (await dcRouter.pendingStrategyWithdrawals(strategyId)).toString()
      ).to.equal(zeroAmount);
      await dcRouter
        .connect(userWallet)
        .initiateWithdraw(strategyId, WITHDRAW_ALL);
      expect(
        (await dcRouter.pendingStrategyWithdrawals(strategyId)).toString()
      ).to.equal(WITHDRAW_ALL.toString());
    });

    it("should return userPosition", async function () {
      let deposited = await dcRouter.userPosition(
        userWallet.address,
        strategyId
      );
      expect(deposited.deposit.toString()).to.equal(zeroAmount);
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);

      await dcRouter
        .connect(relayerAddress)
        .transferDeposits(
          [NATIVE_CHAIN_ID],
          [bbMock.address],
          [userDeposit],
          [usdt.address],
          strategyId,
          userDeposit,
          { value: toWei("1") }
        );
      deposited = await dcRouter.userPosition(userWallet.address, strategyId);
      expect(deposited.deposit.toString()).to.equal(userDeposit);
    });

    it("should return pendingDepositsById", async function () {
      const pendingId = "1";
      let pendingDepositRequest = (
        await dcRouter.pendingDepositsById(strategyId, pendingId)
      ).amount;
      expect(pendingDepositRequest.toString()).to.equal(zeroAmount);

      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);
      pendingDepositRequest = (
        await dcRouter.pendingDepositsById(strategyId, pendingId)
      ).amount;
      expect(pendingDepositRequest.toString()).to.equal(userDeposit);
    });

    it("should return lastPendingDepositId", async function () {
      expect(
        (await dcRouter.lastPendingDepositId(strategyId)).toString()
      ).to.equal(zeroAmount);
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);
      const pendingId = "1";
      expect(
        (await dcRouter.lastPendingDepositId(strategyId)).toString()
      ).to.equal(pendingId);
    });

    it("should return maxProcessedDepositId", async function () {
      expect(await dcRouter.maxProcessedDepositId(strategyId)).to.equal(
        zeroAmount
      );
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);
      await dcRouter
        .connect(relayerAddress)
        .transferDeposits(
          [NATIVE_CHAIN_ID],
          [bbMock.address],
          [userDeposit],
          [usdc.address],
          strategyId,
          0,
          { value: toWei("1") }
        );
      expect(await dcRouter.maxProcessedDepositId(strategyId)).to.equal("1");
    });

    it("should return pendingWithdrawalsById", async function () {
      let pendingUserWithdrawal = await dcRouter.pendingWithdrawalsById(
        strategyId,
        "1"
      );
      expect(pendingUserWithdrawal.amount.toString()).to.equal(zeroAmount);
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);
      await dcRouter
        .connect(userWallet)
        .initiateWithdraw(strategyId, userDeposit);
      pendingUserWithdrawal = await dcRouter.pendingWithdrawalsById(
        strategyId,
        1
      );
      await dcRouter
        .connect(relayerAddress)
        .transferDeposits(
          [NATIVE_CHAIN_ID],
          [bbMock.address],
          [userDeposit],
          [usdc.address],
          strategyId,
          "0"
        );
      await usdc.mint(dcRouter.address, userDeposit);

      const approveAmount = toWei("1");
      await dcRouter
        .connect(relayerAddress)
        .approveWithdraw(approveAmount, strategyId, "1");
      pendingUserWithdrawal = await dcRouter.pendingWithdrawalsById(
        strategyId,
        1
      );
      expect(pendingUserWithdrawal.amount.toString()).to.equal(userDeposit);
    });

    it("should return lastPendingWithdrawalId", async function () {
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);
      expect(
        (await dcRouter.lastPendingWithdrawalId(strategyId)).toString()
      ).to.equal(zeroAmount);

      await dcRouter
        .connect(userWallet)
        .initiateWithdraw(strategyId, userDeposit);
      expect(
        (await dcRouter.lastPendingWithdrawalId(strategyId)).toString()
      ).to.equal("1");
      await dcRouter
        .connect(relayerAddress)
        .transferDeposits(
          [NATIVE_CHAIN_ID],
          [bbMock.address],
          [userDeposit],
          [usdc.address],
          strategyId,
          "0"
        );
      await usdc.mint(dcRouter.address, userDeposit);

      await dcRouter
        .connect(relayerAddress)
        .approveWithdraw(userDeposit, strategyId, "1");
      expect(
        (await dcRouter.lastPendingWithdrawalId(strategyId)).toString()
      ).to.equal("1");
    });

    it("should return maxProcessedWithdrawalId", async function () {
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);
      const initialWithdrawalId = await dcRouter.maxProcessedWithdrawalId(
        strategyId
      );
      expect(initialWithdrawalId).to.equal(zeroAmount);

      await dcRouter
        .connect(userWallet)
        .initiateWithdraw(strategyId, userDeposit);
      const approveAmount = toWei("1");
      expect(await dcRouter.maxProcessedWithdrawalId(strategyId)).to.equal(
        zeroAmount
      );
      await dcRouter
        .connect(relayerAddress)
        .transferDeposits(
          [NATIVE_CHAIN_ID],
          [bbMock.address],
          [userDeposit],
          [usdc.address],
          strategyId,
          "0"
        );
      await usdc.mint(dcRouter.address, userDeposit);

      await dcRouter
        .connect(relayerAddress)
        .approveWithdraw(approveAmount, strategyId, 1);

      const newWithdrawalId = await dcRouter.maxProcessedWithdrawalId(
        strategyId
      );
      expect(initialWithdrawalId.add(1)).to.equal(newWithdrawalId);
    });
  });

  describe("Basic Transactions", function () {
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

    it("should deposit 100 usdc", async function () {
      expect(
        (
          await dcRouter.connect(userWallet).pendingStrategyDeposits(0)
        ).toString()
      ).to.equal(zeroAmount);

      expect(
        await usdc.connect(userWallet).approve(dcRouter.address, userDeposit)
      )
        .to.emit(dcRouter, "Approval")
        .withArgs(userWallet.address, dcRouter.address, userDeposit);

      expect((await usdc.balanceOf(userWallet.address)).toString()).to.equal(
        userDeposit
      );
      expect((await usdc.balanceOf(dcRouter.address)).toString()).to.equal(
        zeroAmount
      );
      const pendingId = "1";
      expect(
        await dcRouter.connect(userWallet).deposit(strategyId, userDeposit)
      )
        .to.emit(dcRouter, "Deposited")
        .withArgs(userWallet.address, strategyId, userDeposit)
        .to.emit(dcRouter, "Transfer")
        .withArgs(userWallet.address, dcRouter.address, userDeposit);

      const pendingDepositRequest = (
        await dcRouter.pendingDepositsById(strategyId, pendingId)
      ).amount;

      expect(pendingDepositRequest.toString()).to.equal(userDeposit);
      expect((await usdc.balanceOf(userWallet.address)).toString()).to.equal(
        zeroAmount
      );
      expect((await usdc.balanceOf(dcRouter.address)).toString()).to.equal(
        userDeposit
      );
      expect(
        (await dcRouter.pendingStrategyDeposits(strategyId)).toString()
      ).to.equal(userDeposit);
      expect(
        (await dcRouter.lastPendingDepositId(strategyId)).toString()
      ).to.equal(pendingId);
    });

    it("should initiate withdraw for amount", async function () {
      const pendingId = "1";
      expect(
        await usdc.connect(userWallet).approve(dcRouter.address, userDeposit)
      )
        .to.emit(dcRouter, "Approval")
        .withArgs(userWallet.address, dcRouter.address, userDeposit);

      expect(
        await dcRouter.connect(userWallet).deposit(strategyId, userDeposit)
      )
        .to.emit(dcRouter, "Deposited")
        .withArgs(userWallet.address, strategyId, userDeposit);

      expect(
        (await dcRouter.pendingStrategyWithdrawals(strategyId)).toString()
      ).to.equal(zeroAmount);
      expect(
        (await dcRouter.lastPendingWithdrawalId(strategyId)).toString()
      ).to.equal(zeroAmount);

      expect(
        await dcRouter
          .connect(userWallet)
          .initiateWithdraw(strategyId, userDeposit)
      )
        .to.emit(dcRouter, "RequestedWithdraw")
        .withArgs(userWallet.address, strategyId, userDeposit);

      expect(
        (await dcRouter.pendingStrategyWithdrawals(strategyId)).toString()
      ).to.equal(userDeposit);
      expect(
        (await dcRouter.lastPendingWithdrawalId(strategyId)).toString()
      ).to.equal(pendingId);
    });

    it("should transfer Deposits", async function () {
      const otherStrategyId = "777";
      await usdc.connect(userWallet).approve(dcRouter.address, userDeposit);
      await dcRouter.connect(userWallet).deposit(otherStrategyId, userDeposit);

      expect(
        await dcRouter
          .connect(relayerAddress)
          .transferDeposits(
            [NATIVE_CHAIN_ID],
            [bbMock.address],
            [userDeposit],
            [usdc.address],
            otherStrategyId,
            0,
            { value: toWei("1") }
          )
      )
        .to.emit(relayerAddress, "DepositTransferred")
        .withArgs(userWallet.address, NATIVE_CHAIN_ID, userDeposit);
      expect(await dcRouter.maxProcessedDepositId(otherStrategyId)).to.equal(
        "1"
      );
    });

    it("should pull Out Loss ERC20", async function () {
      expect((await usdt.balanceOf(dcRouter.address)).toString()).to.equal(
        zeroAmount
      );
      await usdt.mint(dcRouter.address, userDeposit);
      expect((await usdt.balanceOf(dcRouter.address)).toString()).to.equal(
        userDeposit
      );
      expect((await usdt.balanceOf(deployer.address)).toString()).to.equal(
        zeroAmount
      );
      await dcRouter
        .connect(relayerAddress)
        .withdrawLossTokens(usdt.address, userDeposit);
      expect((await usdt.balanceOf(dcRouter.address)).toString()).to.equal(
        zeroAmount
      );
      expect((await usdt.balanceOf(deployer.address)).toString()).to.equal(
        userDeposit
      );
    });

    it("should withdraw Lost ETH", async function () {
      const transactionAmount = toWei("1");
      expect((await provider.getBalance(dcRouter.address)).toString()).to.equal(
        zeroAmount
      );
      await userWallet.sendTransaction({
        to: dcRouter.address,
        value: transactionAmount,
      });
      expect((await provider.getBalance(dcRouter.address)).toString()).to.equal(
        transactionAmount
      );
      await dcRouter
        .connect(relayerAddress)
        .withdrawLossTokens(ZERO_ADDRESS, toWei("1"));
      expect((await provider.getBalance(dcRouter.address)).toString()).to.equal(
        zeroAmount
      );
    });

    it("should revert withdraw Lost tokens with onlyRelayer", async function () {
      const transactionAmount = toWei("1");
      expect((await provider.getBalance(dcRouter.address)).toString()).to.equal(
        zeroAmount
      );
      await userWallet.sendTransaction({
        to: dcRouter.address,
        value: transactionAmount,
      });
      expect((await provider.getBalance(dcRouter.address)).toString()).to.equal(
        transactionAmount
      );
      await expectRevert(
        dcRouter.withdrawLossTokens(ZERO_ADDRESS, toWei("1")),
        "BaseAppStorage:Only relayer"
      );

      expect((await provider.getBalance(dcRouter.address)).toString()).to.equal(
        toWei("1")
      );
    });

    it("should approve withdraw", async function () {
      expect(
        await usdc.connect(userWallet).approve(dcRouter.address, userDeposit)
      )
        .to.emit(dcRouter, "Approval")
        .withArgs(userWallet.address, dcRouter.address, userDeposit);

      expect(
        await dcRouter.connect(userWallet).deposit(strategyId, userDeposit)
      )
        .to.emit(dcRouter, "Deposited")
        .withArgs(userWallet.address, strategyId, userDeposit);

      expect(
        await dcRouter
          .connect(userWallet)
          .initiateWithdraw(strategyId, userDeposit)
      )
        .to.emit(dcRouter, "RequestedWithdraw")
        .withArgs(userWallet.address, strategyId, userDeposit);

      await dcRouter
        .connect(relayerAddress)
        .transferDeposits(
          [NATIVE_CHAIN_ID],
          [bbMock.address],
          [userDeposit],
          [usdc.address],
          strategyId,
          "0"
        );
      await usdc.mint(dcRouter.address, userDeposit);

      const approveAmount = toWei("1");

      expect(
        await dcRouter
          .connect(relayerAddress)
          .approveWithdraw(approveAmount, strategyId, 1)
      )
        .to.emit(dcRouter, "Withdrawn")
        .withArgs(userWallet.address, strategyId, userDeposit);
    });

    it("should approve full withdraw", async function () {
      const strategyTVL = "0";
      const userBalanceStart = await usdc.balanceOf(userWallet.address);
      expect(
        await usdc.connect(userWallet).approve(dcRouter.address, userDeposit)
      )
        .to.emit(dcRouter, "Approval")
        .withArgs(userWallet.address, dcRouter.address, userDeposit);

      expect(
        await dcRouter.connect(userWallet).deposit(strategyId, userDeposit)
      )
        .to.emit(dcRouter, "Deposited")
        .withArgs(userWallet.address, strategyId, userDeposit);

      await dcRouter
        .connect(relayerAddress)
        .transferDeposits(
          [NATIVE_CHAIN_ID],
          [bbMock.address],
          [userDeposit],
          [usdc.address],
          strategyId,
          strategyTVL
        );

      expect(
        await dcRouter
          .connect(userWallet)
          .initiateWithdraw(strategyId, WITHDRAW_ALL)
      )
        .to.emit(dcRouter, "RequestedWithdraw")
        .withArgs(userWallet.address, strategyId, WITHDRAW_ALL);

      await usdc.mint(dcRouter.address, userDeposit);

      expect(
        await dcRouter
          .connect(relayerAddress)
          .approveWithdraw(toWei("1").toString(), strategyId, 1)
      )
        .to.emit(dcRouter, "Withdrawn")
        .withArgs(userWallet.address, strategyId, userDeposit);
      const userBalanceEnd = await usdc.balanceOf(userWallet.address);
      expect(userBalanceEnd).to.equal(userBalanceStart);
    });

    it("should cancel withdraw", async function () {
      await usdc.connect(userWallet).approve(dcRouter.address, userDeposit);
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);
      await dcRouter
        .connect(userWallet)
        .initiateWithdraw(strategyId, userDeposit);
      expect(
        await dcRouter
          .connect(relayerAddress)
          .cancelWithdraw(NATIVE_CHAIN_ID, strategyId)
      )
        .to.emit(dcRouter, "CancelWithdrawn")
        .withArgs(userWallet.address, strategyId, userDeposit);
    });

    it("should cancel full withdraw", async function () {
      await usdc.connect(userWallet).approve(dcRouter.address, userDeposit);
      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);
      await dcRouter
        .connect(userWallet)
        .initiateWithdraw(strategyId, WITHDRAW_ALL);
      expect(
        await dcRouter
          .connect(relayerAddress)
          .cancelWithdraw(NATIVE_CHAIN_ID, strategyId)
      )
        .to.emit(dcRouter, "CancelWithdrawn")
        .withArgs(userWallet.address, strategyId, WITHDRAW_ALL);

      const pendingWithdrawal = await dcRouter.pendingStrategyWithdrawals(
        strategyId
      );
      expect(pendingWithdrawal).to.equal(0);
    });

    it("Should calculate shares", async function () {
      const otherStrId = "100";
      await usdc.connect(userWallet).approve(dcRouter.address, userDeposit);
      await dcRouter.connect(userWallet).deposit(otherStrId, userDeposit);

      await dcRouter
        .connect(relayerAddress)
        .transferDeposits(
          [NATIVE_CHAIN_ID],
          [bbMock.address],
          [userDeposit],
          [usdt.address],
          otherStrId,
          userDeposit,
          { value: toWei("1") }
        );
      const deposited = await dcRouter.userPosition(
        userWallet.address,
        otherStrId
      );
      expect(deposited.deposit.toString()).to.equal(userDeposit);
      expect(deposited.shares.toString()).to.equal(userDeposit);
    });
  });

  describe("Failed actions", function () {
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

    it("should revert deposit with transfer failed", async function () {
      await dcRouter.connect(relayerAddress).setStable(failERC20.address);
      await failERC20.mint(userWallet2.address, userDeposit);
      await failERC20.approve(dcRouter.address, userDeposit);
      await expectRevert(
        dcRouter.connect(userWallet2).deposit(strategyId, userDeposit),
        "DcRouter::deposit: transfer failed"
      );
      await dcRouter.connect(relayerAddress).setStable(usdc.address);
    });

    it("should revert withdraw loss tokens with transfer failed", async function () {
      await failERC20.mint(dcRouter.address, userDeposit);
      await expectRevert(
        dcRouter
          .connect(relayerAddress)
          .withdrawLossTokens(failERC20.address, userDeposit),
        "DcRouter::withdrawLossTokens: transfer failed"
      );
    });

    it("should revert approveWithdraw with transfer failed", async function () {
      await failERC20.mint(dcRouter.address, userDeposit);
      await failERC20.approve(dcRouter.address, userDeposit);

      await dcRouter.connect(userWallet).deposit(strategyId, userDeposit);
      await dcRouter
        .connect(userWallet)
        .initiateWithdraw(strategyId, userDeposit);
      const approveAmount = toWei("1");

      await dcRouter.connect(relayerAddress).setStable(failERC20.address);

      await dcRouter
        .connect(relayerAddress)
        .transferDeposits(
          [NATIVE_CHAIN_ID],
          [bbMock.address],
          [userDeposit],
          [usdc.address],
          strategyId,
          "0"
        );
      await usdc.mint(dcRouter.address, userDeposit);

      await expectRevert(
        dcRouter
          .connect(relayerAddress)
          .approveWithdraw(approveAmount, strategyId, "1"),
        "DcRouter::approveWithdraw: transfer failed"
      );
      await dcRouter.connect(relayerAddress).setStable(usdc.address);
    });

    it("should revert deposit with zero amount", async function () {
      expect(
        await usdc.connect(userWallet).approve(dcRouter.address, userDeposit)
      )
        .to.emit(dcRouter, "Approval")
        .withArgs(userWallet.address, dcRouter.address, userDeposit);

      await expectRevert(
        dcRouter.connect(userWallet).deposit(strategyId, zeroAmount),
        "DcRouter::deposit: zero amount"
      );
    });

    it("should revert transfer deposits with users amount mismatch", async function () {
      const otherStrId = "8";
      await usdc.connect(userWallet2).approve(dcRouter.address, userDeposit);

      await dcRouter.connect(userWallet2).deposit(otherStrId, userDeposit);
      await dcRouter
        .connect(userWallet2)
        .initiateWithdraw(otherStrId, userDeposit);
      const pendingUserWithdrawal = await dcRouter.pendingWithdrawalsById(
        otherStrId,
        1
      );
      expect(pendingUserWithdrawal.amount.toString()).to.equal(userDeposit);
      let totalPendingWithdrawal = await dcRouter.pendingStrategyWithdrawals(
        otherStrId
      );
      expect(totalPendingWithdrawal.toString()).to.equal(userDeposit);

      expect(
        await dcRouter
          .connect(relayerAddress)
          .cancelWithdraw(NATIVE_CHAIN_ID, otherStrId)
      )
        .to.emit(dcRouter, "CancelWithdrawn")
        .withArgs(userWallet.address, NATIVE_CHAIN_ID, userDeposit);

      totalPendingWithdrawal = await dcRouter.pendingStrategyWithdrawals(
        otherStrId
      );
      expect(totalPendingWithdrawal.toString()).to.equal("0");
      const incorrectTVL = userDeposit * 3;
      await expectRevert(
        dcRouter
          .connect(relayerAddress)
          .transferDeposits(
            [NATIVE_CHAIN_ID],
            [bbMock.address],
            [userDeposit, userDeposit],
            [usdt.address],
            8,
            incorrectTVL,
            { value: toWei("1") }
          ),
        "DcRouter::transferDeposits: users amount mismatch"
      );
    });

    it("should revert transfer deposits with no deposit to process", async function () {
      const otherStrategyId = "777";
      await expectRevert(
        dcRouter
          .connect(relayerAddress)
          .transferDeposits(
            [NATIVE_CHAIN_ID],
            [bbMock.address],
            [userDeposit],
            [usdc.address],
            otherStrategyId,
            0,
            { value: toWei("1") }
          ),
        "DcRouter::transferDeposits: no deposit to process"
      );
    });

    it("should revert approve withdraw with invalid request id", async function () {
      expect(
        await usdc.connect(userWallet).approve(dcRouter.address, userDeposit)
      )
        .to.emit(dcRouter, "Approval")
        .withArgs(userWallet.address, dcRouter.address, userDeposit);

      expect(
        await dcRouter.connect(userWallet).deposit(strategyId, userDeposit)
      )
        .to.emit(dcRouter, "Deposited")
        .withArgs(userWallet.address, strategyId, userDeposit);

      expect(
        await dcRouter
          .connect(userWallet)
          .initiateWithdraw(strategyId, userDeposit)
      )
        .to.emit(dcRouter, "RequestedWithdraw")
        .withArgs(userWallet.address, strategyId, userDeposit);

      const incorrectWithdrawId = "34";
      const payableAmount = toWei("1");

      await expectRevert(
        dcRouter
          .connect(relayerAddress)
          .approveWithdraw(payableAmount, strategyId, incorrectWithdrawId),
        "DcRouter::approveWithdraw: invalid request id"
      );
    });

    it("should revert cancel withdraw with invalid request id", async function () {
      expect(
        await usdc.connect(userWallet).approve(dcRouter.address, userDeposit)
      )
        .to.emit(dcRouter, "Approval")
        .withArgs(userWallet.address, dcRouter.address, userDeposit);

      expect(
        await dcRouter.connect(userWallet).deposit(strategyId, userDeposit)
      )
        .to.emit(dcRouter, "Deposited")
        .withArgs(userWallet.address, strategyId, userDeposit);

      expect(
        await dcRouter
          .connect(userWallet)
          .initiateWithdraw(strategyId, userDeposit)
      )
        .to.emit(dcRouter, "RequestedWithdraw")
        .withArgs(userWallet.address, strategyId, userDeposit);

      const incorrectWithdrawId = "34";
      await expectRevert(
        dcRouter
          .connect(relayerAddress)
          .cancelWithdraw(incorrectWithdrawId, strategyId),
        "DcRouter::cancelWithdraw: invalid request id"
      );
    });
  });
});
