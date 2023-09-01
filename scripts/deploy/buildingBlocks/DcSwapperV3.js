const hre = require("hardhat");
const { ethers, upgrades} = require("hardhat");
const {CONFIG} = require("../../ConfigUtils");

async function main(){
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const network = hre.network.name;
    const DcSwapperV3 = await ethers.getContractFactory('DcSwapperV3');
    const initParams = ethers.utils.defaultAbiCoder.encode(
        [
            "address",
            "address",
            "address",
            "address",
            "uint24[]",
            "uint16",
            "address",
            "address",
        ],
        [
            CONFIG.UNISWAP_V3.ROUTER[network],
            CONFIG.ASSETS.USDC[network],
            CONFIG.ASSETS.WETH[network],
            CONFIG.UNISWAP_V3.FACTORY[network],
            [100, 500, 3000, 10000],
            CONFIG.LZ_ENDPOINTS[network].ID,
            CONFIG.DE_COMMAS_REGISTER,
            CONFIG.ROUTERS[network],
        ]
      );

    const dcSwapperV3 = await upgrades.deployProxy(DcSwapperV3,[initParams]);
    await dcSwapperV3.deployed();

    console.log("DcSwapperV3 deployed to:", dcSwapperV3.address);
    console.log("Verifying ");
    const contractAddress = dcSwapperV3.address;
    const implAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    console.log("DcSwapperV3 implementation: ", implAddress);
    await dcSwapperV3.transferOwnership(deployer.address);
       await hre.run("verify:verify", {
          address: implAddress,
      });
}
main().then(() => process.exit(0)).catch((error) => {console.error(error);process.exit(1);});
