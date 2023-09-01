const { artifacts } = require("hardhat");
const { deployMockContract } = require("@ethereum-waffle/mock-contract");

async function getMock(signer, contract) {
  const ContractArtifact = await artifacts.readArtifact(contract);
  return deployMockContract(signer, ContractArtifact.abi);
}

module.exports = {
  getMock,
};
