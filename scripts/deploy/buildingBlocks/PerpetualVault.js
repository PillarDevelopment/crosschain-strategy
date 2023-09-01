const hre = require("hardhat");
const { ethers, upgrades } = require("hardhat");
const {CONFIG, updateConfig} = require("../../ConfigUtils");

async function main() {
    const network = hre.network.name;
    const PERP_BB = await ethers.getContractFactory('PerpetualVault');
    const initParams = ethers.utils.defaultAbiCoder.encode(
    [
      "address",
      "address",
      "address",
      "address",
      "address",
      "uint16",
      "uint160",
      "address"
    ],
    [
        CONFIG.DE_COMMAS_REGISTER,
        CONFIG.PERP_PROTOCOL.PERP_PORTAL[network],
        CONFIG.ASSETS.USDC[network],
        CONFIG.ASSETS.WETH[network],
        CONFIG.PERP_PROTOCOL.V_ETH[network],
        CONFIG.LZ_ENDPOINTS[network].ID,
        300,
        CONFIG.ROUTERS[network],
    ]
    );
    const perpetualVault = await upgrades.deployProxy(PERP_BB,[initParams]);
    await perpetualVault.deployed();
    console.log("perpetualVault deployed to:", perpetualVault.address);
    CONFIG.PERP_BB[network] = perpetualVault.address;
    updateConfig(CONFIG);
    console.log("Verifying ");
    const contractAddress = perpetualVault.address;
    const implAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    console.log("PerpetualVault implementation: ", implAddress);
    // await upgrades.admin.transferProxyAdminOwnership(DEPLOYER);
     await hre.run("verify:verify", {
        address: implAddress,
    });
}

main().then(() => process.exit(0)).catch((error) => {console.error(error);process.exit(1);});
