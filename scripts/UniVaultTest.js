const hre = require("hardhat");

const { ethers } = require("hardhat");

async function main() {
  console.log("Running deploy script");

  this.UniVault = await hre.ethers.getContractFactory("UniswapVault");
  this.ERC20 = await ethers.getContractFactory("ERC20");
  const usdt = this.ERC20.attach("0xc2132d05d31c914a87c6611c10748aeb04b58e8f");

  const uniVault = await this.UniVault.attach(
    "0xB46b06a7913800e3797B4089560352d5a4470072"
  );

  const [owner] = await ethers.getSigners();

  const USER = "0x8E0eeC5bCf1Ee6AB986321349ff4D08019e29918";
  await owner.sendTransaction({
    to: USER,
    value: ethers.utils.parseEther("50.0"), // Sends exactly 1.0 ether
  });

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [USER],
  });
  const signer = await ethers.getSigner(USER);

  await usdt.connect(signer).transfer(uniVault.address, "2000000");

  console.log((await signer.getBalance()).toString());
  console.log((await uniVault.getReserve()).toString());
  console.log("Bridging");

  await signer.sendTransaction({
    to: uniVault.address,
    data: "0x6b0365c300000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000f4240",
  });

  console.log((await uniVault.getReserve()).toString());
  console.log((await signer.getBalance()).toString());

  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [USER],
  });
}

main().catch((error) => {
  throw error;
});
