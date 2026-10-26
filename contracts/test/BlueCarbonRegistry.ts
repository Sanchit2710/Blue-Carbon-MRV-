import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

// Off-chain UUID -> bytes32: 0x + 32 zero hex chars + uuid hex (no dashes).
const uuidToBytes32 = (u: string) => "0x" + u.replace(/-/g, "").padStart(64, "0");
const PROJECT = uuidToBytes32("3f2b8c1e-9a4d-4e7b-8c55-0a1b2c3d4e5f");
const START = 1_700_000_000;
const END = 1_731_536_000;
const QTY = 10_000n; // 100.00 tCO2e
const EVIDENCE = ethers.keccak256(ethers.toUtf8Bytes("evidence"));

async function deploy() {
  const [admin, verifier, owner, buyer, stranger] = await ethers.getSigners();
  const reg = await ethers.deployContract("BlueCarbonRegistry", [admin.address, "ipfs://x/{id}"]);
  await reg.grantRole(await reg.VERIFIER_ROLE(), verifier.address);
  return { reg, admin, verifier, owner, buyer, stranger };
}

async function withProject() {
  const f = await deploy();
  await f.reg.connect(f.verifier).registerProject(PROJECT, f.owner.address);
  return f;
}

async function withBatch() {
  const f = await withProject();
  await f.reg.connect(f.verifier).issueBatch(PROJECT, START, END, "VM0033", "ipfs://report", QTY);
  const batchId = await f.reg.batchIdOf(PROJECT, START, END);
  return { ...f, batchId };
}

describe("BlueCarbonRegistry", () => {
  describe("roles", () => {
    it("admin holds both roles; stranger holds none", async () => {
      const { reg, admin, stranger } = await loadFixture(deploy);
      expect(await reg.hasRole(await reg.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await reg.hasRole(await reg.VERIFIER_ROLE(), admin.address)).to.be.true;
      expect(await reg.hasRole(await reg.VERIFIER_ROLE(), stranger.address)).to.be.false;
    });

    it("non-verifier cannot register, issue or record milestones", async () => {
      const { reg, stranger, owner } = await loadFixture(withBatch);
      await expect(reg.connect(stranger).registerProject(uuidToBytes32("1-2"), owner.address))
        .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
      await expect(reg.connect(stranger).issueBatch(PROJECT, 1, 2, "m", "r", 1))
        .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
      await expect(reg.connect(stranger).recordMilestone(PROJECT, 0, EVIDENCE, 0))
        .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    });

    it("only admin can grant roles and pause", async () => {
      const { reg, verifier, stranger } = await loadFixture(deploy);
      const role = await reg.VERIFIER_ROLE();
      await expect(reg.connect(verifier).grantRole(role, stranger.address))
        .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
      await expect(reg.connect(verifier).pause()).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    });
  });

  describe("project registration", () => {
    it("registers and emits", async () => {
      const { reg, verifier, owner } = await loadFixture(deploy);
      await expect(reg.connect(verifier).registerProject(PROJECT, owner.address))
        .to.emit(reg, "ProjectRegistered").withArgs(PROJECT, owner.address);
      expect(await reg.projectOwner(PROJECT)).to.equal(owner.address);
    });

    it("rejects duplicates, zero id, zero owner", async () => {
      const { reg, verifier, owner } = await loadFixture(withProject);
      await expect(reg.connect(verifier).registerProject(PROJECT, owner.address))
        .to.be.revertedWithCustomError(reg, "ProjectAlreadyRegistered").withArgs(PROJECT);
      await expect(reg.connect(verifier).registerProject(ethers.ZeroHash, owner.address))
        .to.be.revertedWithCustomError(reg, "ZeroProjectId");
      await expect(reg.connect(verifier).registerProject(uuidToBytes32("a-b"), ethers.ZeroAddress))
        .to.be.revertedWithCustomError(reg, "ZeroAddress");
    });
  });

  describe("issuance", () => {
    it("mints to project owner, stores batch, emits", async () => {
      const { reg, verifier, owner } = await loadFixture(withProject);
      const batchId = await reg.batchIdOf(PROJECT, START, END);
      await expect(reg.connect(verifier).issueBatch(PROJECT, START, END, "VM0033", "ipfs://report", QTY))
        .to.emit(reg, "BatchIssued")
        .withArgs(batchId, PROJECT, START, END, "VM0033", "ipfs://report", QTY, owner.address);
      expect(await reg.balanceOf(owner.address, batchId)).to.equal(QTY);
      const b = await reg.getBatch(batchId);
      expect(b.projectId).to.equal(PROJECT);
      expect(b.methodology).to.equal("VM0033");
      expect(b.verificationRef).to.equal("ipfs://report");
      expect(b.issued).to.equal(QTY);
      expect(b.retired).to.equal(0);
    });

    it("reverts on duplicate (project, start, end)", async () => {
      const { reg, verifier, batchId } = await loadFixture(withBatch);
      await expect(reg.connect(verifier).issueBatch(PROJECT, START, END, "VM0033", "other", 5))
        .to.be.revertedWithCustomError(reg, "BatchAlreadyIssued").withArgs(batchId);
    });

    it("allows a different period for the same project", async () => {
      const { reg, verifier } = await loadFixture(withBatch);
      await expect(reg.connect(verifier).issueBatch(PROJECT, END, END + 1000, "VM0033", "r2", 5)).to.not.be.reverted;
    });

    it("reverts for unregistered project", async () => {
      const { reg, verifier } = await loadFixture(deploy);
      await expect(reg.connect(verifier).issueBatch(PROJECT, START, END, "m", "r", QTY))
        .to.be.revertedWithCustomError(reg, "ProjectNotRegistered").withArgs(PROJECT);
    });

    it("reverts on zero quantity and bad period", async () => {
      const { reg, verifier } = await loadFixture(withProject);
      await expect(reg.connect(verifier).issueBatch(PROJECT, START, END, "m", "r", 0))
        .to.be.revertedWithCustomError(reg, "ZeroQuantity");
      await expect(reg.connect(verifier).issueBatch(PROJECT, END, START, "m", "r", 1))
        .to.be.revertedWithCustomError(reg, "InvalidPeriod");
    });
  });

  describe("transfers", () => {
    it("holder can transfer non-retired balance", async () => {
      const { reg, owner, buyer, batchId } = await loadFixture(withBatch);
      await reg.connect(owner).safeTransferFrom(owner.address, buyer.address, batchId, 400, "0x");
      expect(await reg.balanceOf(buyer.address, batchId)).to.equal(400);
      expect(await reg.balanceOf(owner.address, batchId)).to.equal(QTY - 400n);
    });

    it("cannot transfer more than balance", async () => {
      const { reg, owner, buyer, batchId } = await loadFixture(withBatch);
      await expect(reg.connect(owner).safeTransferFrom(owner.address, buyer.address, batchId, QTY + 1n, "0x"))
        .to.be.revertedWithCustomError(reg, "ERC1155InsufficientBalance");
    });
  });

  describe("retirement", () => {
    it("burns, tracks total, emits", async () => {
      const { reg, owner, batchId } = await loadFixture(withBatch);
      await expect(reg.connect(owner).retire(batchId, 300, owner.address, "2025 offset"))
        .to.emit(reg, "CreditsRetired").withArgs(batchId, owner.address, owner.address, 300, "2025 offset");
      expect(await reg.retiredTotal(batchId)).to.equal(300);
      expect(await reg.balanceOf(owner.address, batchId)).to.equal(QTY - 300n);
      expect((await reg.getBatch(batchId)).retired).to.equal(300);
    });

    it("retired credits cannot be transferred or re-retired beyond remaining balance", async () => {
      const { reg, owner, buyer, batchId } = await loadFixture(withBatch);
      await reg.connect(owner).retire(batchId, QTY, buyer.address, "all");
      await expect(reg.connect(owner).safeTransferFrom(owner.address, buyer.address, batchId, 1, "0x"))
        .to.be.revertedWithCustomError(reg, "ERC1155InsufficientBalance");
      await expect(reg.connect(owner).retire(batchId, 1, buyer.address, "x"))
        .to.be.revertedWithCustomError(reg, "ERC1155InsufficientBalance");
      expect(await reg.retiredTotal(batchId)).to.equal(QTY);
    });

    it("cannot retire more than balance (even if others hold supply)", async () => {
      const { reg, owner, buyer, batchId } = await loadFixture(withBatch);
      await reg.connect(owner).safeTransferFrom(owner.address, buyer.address, batchId, 100, "0x");
      await expect(reg.connect(buyer).retire(batchId, 101, buyer.address, "x"))
        .to.be.revertedWithCustomError(reg, "ERC1155InsufficientBalance");
    });

    it("reverts on zero qty and unknown batch; sums across holders", async () => {
      const { reg, owner, buyer, batchId } = await loadFixture(withBatch);
      await expect(reg.connect(owner).retire(batchId, 0, owner.address, "x")).to.be.revertedWithCustomError(reg, "ZeroQuantity");
      await expect(reg.connect(owner).retire(123, 1, owner.address, "x")).to.be.revertedWithCustomError(reg, "BatchNotFound");
      await reg.connect(owner).safeTransferFrom(owner.address, buyer.address, batchId, 100, "0x");
      await reg.connect(owner).retire(batchId, 200, owner.address, "a");
      await reg.connect(buyer).retire(batchId, 50, buyer.address, "b");
      expect(await reg.retiredTotal(batchId)).to.equal(250);
    });
  });

  describe("maintenance milestones", () => {
    it("verifier records; stored and emitted", async () => {
      const { reg, verifier } = await loadFixture(withProject);
      await expect(reg.connect(verifier).recordMilestone(PROJECT, 2, EVIDENCE, 1))
        .to.emit(reg, "MilestoneRecorded").withArgs(PROJECT, 2, EVIDENCE, 1);
      const m = await reg.milestones(PROJECT, 2);
      expect(m.evidenceHash).to.equal(EVIDENCE);
      expect(m.outcome).to.equal(1);
      expect(m.recordedAt).to.be.gt(0);
    });

    it("rejects unregistered project and non-verifier", async () => {
      const { reg, verifier, stranger } = await loadFixture(withProject);
      await expect(reg.connect(verifier).recordMilestone(uuidToBytes32("9-9"), 0, EVIDENCE, 0))
        .to.be.revertedWithCustomError(reg, "ProjectNotRegistered");
      await expect(reg.connect(stranger).recordMilestone(PROJECT, 0, EVIDENCE, 0))
        .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    });
  });

  describe("pause", () => {
    it("blocks state changes and transfers, resumes after unpause", async () => {
      const { reg, admin, verifier, owner, buyer, batchId } = await loadFixture(withBatch);
      await reg.connect(admin).pause();
      await expect(reg.connect(verifier).registerProject(uuidToBytes32("5-5"), owner.address))
        .to.be.revertedWithCustomError(reg, "EnforcedPause");
      await expect(reg.connect(owner).safeTransferFrom(owner.address, buyer.address, batchId, 1, "0x"))
        .to.be.revertedWithCustomError(reg, "EnforcedPause");
      await expect(reg.connect(owner).retire(batchId, 1, owner.address, "x"))
        .to.be.revertedWithCustomError(reg, "EnforcedPause");
      await reg.connect(admin).unpause();
      await expect(reg.connect(owner).safeTransferFrom(owner.address, buyer.address, batchId, 1, "0x")).to.not.be.reverted;
    });
  });
});
