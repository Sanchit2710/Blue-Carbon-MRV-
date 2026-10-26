import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const PROJECT = "0x" + "3f2b8c1e9a4d4e7b8c550a1b2c3d4e5f".padEnd(64, "0");
const START = 1_700_000_000;
const END = 1_731_536_000;
const QTY = 10_000n; // 100.00 tCO2e
const PRICE = ethers.parseEther("0.0001") / 100n; // per hundredth => 0.0001 ETH per tCO2e

async function deploy() {
  const [admin, seller, buyer, stranger] = await ethers.getSigners();
  const reg = await ethers.deployContract("BlueCarbonRegistry", [admin.address, ""]);
  const market = await ethers.deployContract("BlueCarbonMarketplace", [await reg.getAddress()]);
  await reg.registerProject(PROJECT, seller.address);
  await reg.issueBatch(PROJECT, START, END, "VM0033", "ref", QTY);
  const batchId = await reg.batchIdOf(PROJECT, START, END);
  return { reg, market, admin, seller, buyer, stranger, batchId };
}

async function listed() {
  const f = await deploy();
  await f.reg.connect(f.seller).setApprovalForAll(await f.market.getAddress(), true);
  await f.market.connect(f.seller).list(f.batchId, 4_000n, PRICE);
  return { ...f, listingId: 1n };
}

describe("BlueCarbonMarketplace", () => {
  it("listing needs operator approval, balance, non-zero quantity and price", async () => {
    const { reg, market, seller, batchId } = await loadFixture(deploy);
    await expect(market.connect(seller).list(batchId, 1, PRICE)).to.be.revertedWithCustomError(market, "NotApproved");
    await reg.connect(seller).setApprovalForAll(await market.getAddress(), true);
    await expect(market.connect(seller).list(batchId, QTY + 1n, PRICE)).to.be.revertedWithCustomError(market, "InsufficientBalance");
    await expect(market.connect(seller).list(batchId, 0, PRICE)).to.be.revertedWithCustomError(market, "ZeroQuantity");
    await expect(market.connect(seller).list(batchId, 1, 0)).to.be.revertedWithCustomError(market, "ZeroPrice");
    await expect(market.connect(seller).list(batchId, 4_000n, PRICE))
      .to.emit(market, "Listed").withArgs(1n, seller.address, batchId, 4_000n, PRICE);
  });

  it("purchase moves credits to the buyer and ETH to the seller atomically", async () => {
    const { reg, market, seller, buyer, batchId, listingId } = await loadFixture(listed);
    const cost = 1_500n * PRICE;
    const tx = market.connect(buyer).buy(listingId, 1_500n, { value: cost });
    await expect(tx).to.changeEtherBalances([buyer, seller], [-cost, cost]);
    await expect(tx).to.emit(market, "Purchased").withArgs(listingId, buyer.address, seller.address, batchId, 1_500n, cost);
    expect(await reg.balanceOf(buyer.address, batchId)).to.equal(1_500n);
    expect(await reg.balanceOf(seller.address, batchId)).to.equal(QTY - 1_500n);
    expect((await market.listings(listingId)).remaining).to.equal(2_500n);
  });

  it("rejects wrong payment, over-listing quantity, zero quantity and self-purchase", async () => {
    const { market, seller, buyer, listingId } = await loadFixture(listed);
    await expect(market.connect(buyer).buy(listingId, 10n, { value: 9n * PRICE })).to.be.revertedWithCustomError(market, "WrongPayment").withArgs(10n * PRICE);
    await expect(market.connect(buyer).buy(listingId, 4_001n, { value: 4_001n * PRICE })).to.be.revertedWithCustomError(market, "ExceedsListing").withArgs(4_000n);
    await expect(market.connect(buyer).buy(listingId, 0n)).to.be.revertedWithCustomError(market, "ZeroQuantity");
    await expect(market.connect(seller).buy(listingId, 1n, { value: PRICE })).to.be.revertedWithCustomError(market, "SelfPurchase");
  });

  it("cannot oversell: credits the seller retired or moved after listing can't be bought", async () => {
    const { reg, market, seller, buyer, stranger, batchId, listingId } = await loadFixture(listed);
    await reg.connect(seller).retire(batchId, 7_000n, seller.address, "own claim");
    await reg.connect(seller).safeTransferFrom(seller.address, stranger.address, batchId, 2_000n, "0x");
    // seller now holds 1,000 but the listing still says 4,000
    await expect(market.connect(buyer).buy(listingId, 2_000n, { value: 2_000n * PRICE })).to.be.revertedWithCustomError(reg, "ERC1155InsufficientBalance");
    await market.connect(buyer).buy(listingId, 1_000n, { value: 1_000n * PRICE });
    expect(await reg.balanceOf(buyer.address, batchId)).to.equal(1_000n);
  });

  it("only the seller can cancel; cancelled listings can't be bought", async () => {
    const { market, seller, buyer, listingId } = await loadFixture(listed);
    await expect(market.connect(buyer).cancel(listingId)).to.be.revertedWithCustomError(market, "NotSeller");
    await expect(market.connect(seller).cancel(listingId)).to.emit(market, "Cancelled").withArgs(listingId);
    await expect(market.connect(seller).cancel(listingId)).to.be.revertedWithCustomError(market, "NotActive");
    await expect(market.connect(buyer).buy(listingId, 1n, { value: PRICE })).to.be.revertedWithCustomError(market, "NotActive");
  });

  it("buyer can retire purchased credits, which can never move again", async () => {
    const { reg, market, buyer, stranger, batchId, listingId } = await loadFixture(listed);
    await market.connect(buyer).buy(listingId, 1_000n, { value: 1_000n * PRICE });
    await expect(reg.connect(buyer).retire(batchId, 1_000n, buyer.address, "FY26 claim"))
      .to.emit(reg, "CreditsRetired").withArgs(batchId, buyer.address, buyer.address, 1_000n, "FY26 claim");
    expect(await reg.balanceOf(buyer.address, batchId)).to.equal(0n);
    await expect(reg.connect(buyer).safeTransferFrom(buyer.address, stranger.address, batchId, 1n, "0x")).to.be.revertedWithCustomError(reg, "ERC1155InsufficientBalance");
  });

  it("purchases stop while the registry is paused", async () => {
    const { reg, market, admin, buyer, listingId } = await loadFixture(listed);
    await reg.connect(admin).pause();
    await expect(market.connect(buyer).buy(listingId, 1n, { value: PRICE })).to.be.revertedWithCustomError(reg, "EnforcedPause");
  });
});
