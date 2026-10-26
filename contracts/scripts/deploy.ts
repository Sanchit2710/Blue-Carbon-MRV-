// Not run in this repo's tests. Needs RPC_URL + DEPLOYER_PRIVATE_KEY in .env:
//   npx hardhat run scripts/deploy.ts --network target
import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = process.env.ADMIN_ADDRESS || deployer.address;
  const reg = await ethers.deployContract("BlueCarbonRegistry", [admin, process.env.BASE_URI ?? ""]);
  await reg.waitForDeployment();
  console.log(`BlueCarbonRegistry on ${network.name}: ${await reg.getAddress()}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
