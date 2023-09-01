const hre = require("hardhat");
const {CONFIG, updateConfig} = require('../ConfigUtils.js');

async function main() {
    const network = hre.network.name;
    console.log('Deploying BBFabric to', network);

    const BB_FABRIC_CONTRACT = await hre.ethers.getContractFactory("BBFabric");
    // Reset config
    CONFIG.BB_FABRICS[network] = "";
    updateConfig(CONFIG);
    const bbFabric = await BB_FABRIC_CONTRACT.deploy(
        CONFIG.LZ_ENDPOINTS[network].ID,
        CONFIG.DE_COMMAS_REGISTER,
    );
    await bbFabric.deployed();
    console.log("BBFabric deployed to:", bbFabric.address);
    CONFIG.BB_FABRICS[network] = bbFabric.address;
    updateConfig(CONFIG);

    console.log("Verification string: npx hardhat verify ",
        bbFabric.address,
        CONFIG.LZ_ENDPOINTS[network].ID,
         CONFIG.DE_COMMAS_REGISTER.ADDRESS,
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
