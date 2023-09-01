const fileName = "config/addresses.json";
const fs = require("fs");

if (fs.existsSync("./config/addresses.json")) {
  // file exists
} else {
  throw Error("No addresses.json. Run update-addresses task");
}

// eslint-disable-next-line node/no-missing-require
const dynamicAddresses = require("./../config/addresses.json");
const externalAddresses = require("./../config/external.addresses.json");

const CONFIG = {
  ...externalAddresses,
  ...dynamicAddresses,
};

const updateConfig = (newConfig) => {
  fs.writeFileSync(fileName, JSON.stringify(newConfig, null, 2));
};

module.exports = {
  CONFIG,
  updateConfig,
};
