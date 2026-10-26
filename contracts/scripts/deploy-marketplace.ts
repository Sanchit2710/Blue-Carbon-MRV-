// Deploys BlueCarbonMarketplace against an existing registry:
//   REGISTRY_ADDRESS=0x… npx hardhat run scripts/deploy-marketplace.ts --network target
import { ethers, network } from "hardhat";

async function main() {
  const registry = process.env.REGISTRY_ADDRESS;
  if (!registry) throw new Error("Set REGISTRY_ADDRESS");
  const market = await ethers.deployContract("BlueCarbonMarketplace", [registry]);
  await market.waitForDeployment();
  console.log(`BlueCarbonMarketplace on ${network.name}: ${await market.getAddress()} (registry ${registry})`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
