// Prints the deployer's public address, network and balance. Never prints the key.
import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`network=${network.name} chainId=${chainId} deployer=${deployer.address} balance=${ethers.formatEther(bal)} ETH`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
