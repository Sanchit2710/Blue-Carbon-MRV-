// Read-only checks against a deployed registry: code present, roles held by the expected admin.
import { ethers } from "hardhat";

async function main() {
  const address = process.env.REGISTRY_ADDRESS!;
  const [deployer] = await ethers.getSigners();
  const code = await ethers.provider.getCode(address);
  const reg = await ethers.getContractAt("BlueCarbonRegistry", address);
  const admin = process.env.ADMIN_ADDRESS || deployer.address;
  const [isAdmin, isVerifier, paused] = await Promise.all([
    reg.hasRole(await reg.DEFAULT_ADMIN_ROLE(), admin),
    reg.hasRole(await reg.VERIFIER_ROLE(), admin),
    reg.paused(),
  ]);
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(JSON.stringify({ codeBytes: (code.length - 2) / 2, admin, isAdmin, isVerifier, paused, deployerBalance: ethers.formatEther(bal) }));
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
