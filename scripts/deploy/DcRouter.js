const hre = require("hardhat");
const {CONFIG, updateConfig} = require("../ConfigUtils");

async function main() {
    const network = hre.network.name;
    console.log('Deploying Router contract to', network);

    const DC_ROUTER_CONTRACT = await hre.ethers.getContractFactory("DcRouter");

    // Reset config
    CONFIG.ROUTERS[network] = "";
    updateConfig(CONFIG);

    const dcRouterContract = await DC_ROUTER_CONTRACT.deploy(
      CONFIG.DE_COMMAS_REGISTER,
        CONFIG.DE_COMMAS_REGISTER,
        CONFIG.BRIDGES[network].USDC,
      CONFIG.LZ_ENDPOINTS[network].ID
    );
    await dcRouterContract.deployed();

    console.log("DC_ROUTER_CONTRACT deployed to:", dcRouterContract.address);
    CONFIG.ROUTERS[network] = dcRouterContract.address;
    updateConfig(CONFIG);

    console.log("Verification string: npx hardhat verify ",
        dcRouterContract.address,
        CONFIG.DE_COMMAS_REGISTER,
        CONFIG.DE_COMMAS_REGISTER,
        CONFIG.BRIDGES[network].USDC,
        CONFIG.LZ_ENDPOINTS[network].ID,
        " --network ",
        network
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
