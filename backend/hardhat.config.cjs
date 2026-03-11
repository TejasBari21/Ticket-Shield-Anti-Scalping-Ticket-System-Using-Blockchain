require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

// NEVER hardcode private keys in source code.
// Set ADMIN_PRIVATE_KEY and USER_PRIVATE_KEY in .env (not committed to git).
const adminKey = process.env.ADMIN_PRIVATE_KEY;
const userKey  = process.env.USER_PRIVATE_KEY;

if (!adminKey) {
  console.warn("[hardhat] ADMIN_PRIVATE_KEY not set — accounts will be empty for non-local networks.");
}

const accounts = [adminKey, userKey].filter(Boolean);

const config = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    // Local Hardhat node — run `npm run start` in backend to start it
    // accounts[0] = admin deployer, accounts[1] = test user
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: accounts.length ? accounts : [],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: accounts.length ? accounts : [],
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      accounts: accounts.length ? accounts : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};

module.exports = config;
