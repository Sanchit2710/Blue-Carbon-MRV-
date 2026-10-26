import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const { RPC_URL, CHAIN_ID } = process.env;
// MetaMask exports keys without the 0x prefix; accept both.
const raw = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const DEPLOYER_PRIVATE_KEY = raw ? (raw.startsWith("0x") ? raw : `0x${raw}`) : undefined;

const config: HardhatUserConfig = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" } },
  networks: {
    // Only configured when env is present; nothing is deployed by tests.
    ...(RPC_URL && DEPLOYER_PRIVATE_KEY
      ? { target: { url: RPC_URL, accounts: [DEPLOYER_PRIVATE_KEY], chainId: CHAIN_ID ? Number(CHAIN_ID) : undefined } }
      : {}),
  },
};

export default config;
