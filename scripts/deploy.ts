// scripts/deploy.ts
import { ethers } from "hardhat";
import fs from "fs";

async function tryUnpause(c: any) {
  try {
    if (typeof c.unpause === "function") {
      const tx = await c.unpause();
      await tx.wait();
    }
  } catch {
    // ignore if not pausable or already unpaused
  }
}

async function main() {
  const [admin, clubA, clubB, sponsor1] = await ethers.getSigners();

  // Deploy
  const RoleManager = await ethers.getContractFactory("RoleManager");
  const roles = await RoleManager.deploy(admin.address);
  await roles.waitForDeployment();

  const DemoToken = await ethers.getContractFactory("DemoToken");
  const token = await DemoToken.deploy();
  await token.waitForDeployment();

  const TransferRegistry = await ethers.getContractFactory("TransferRegistry");
  const transfer = await TransferRegistry.deploy(admin.address);
  await transfer.waitForDeployment();

  const PrizePool = await ethers.getContractFactory("PrizePool");
  const prize = await PrizePool.deploy(await roles.getAddress());
  await prize.waitForDeployment();

  const SponsorshipRegistry = await ethers.getContractFactory("SponsorshipRegistry");
  const sponsorship = await SponsorshipRegistry.deploy(await roles.getAddress());
  await sponsorship.waitForDeployment();

  const DisciplinaryRegistry = await ethers.getContractFactory("DisciplinaryRegistry");
  const disciplinary = await DisciplinaryRegistry.deploy(await roles.getAddress());
  await disciplinary.waitForDeployment();

  // Roles (await receipts)
  await (await roles.grantRole(await roles.CLUB_ROLE(), clubA.address)).wait();
  await (await roles.grantRole(await roles.CLUB_ROLE(), clubB.address)).wait();
  await (await roles.grantRole(await roles.SPONSOR_ROLE(), sponsor1.address)).wait();

  // TransferRegistry uses its own AccessControl; grant club role there too
  await (await transfer.grantRole(await transfer.CLUB_ROLE(), clubA.address)).wait();
  await (await transfer.grantRole(await transfer.CLUB_ROLE(), clubB.address)).wait();

  // Note: Contracts using Pausable start unpaused by default
  // Only unpause if specifically needed (commented out for now)
  // await tryUnpause(transfer);
  // await tryUnpause(prize);
  // await tryUnpause(sponsorship);
  // await tryUnpause(disciplinary);

  // Output single JSON line ONLY
  const out = {
    roles: await roles.getAddress(),
    token: await token.getAddress(),
    transfer: await transfer.getAddress(),
    prize: await prize.getAddress(),
    sponsorship: await sponsorship.getAddress(),
    disciplinary: await disciplinary.getAddress(),
    clubA: clubA.address,
    clubB: clubB.address,
    sponsor1: sponsor1.address,
    admin: admin.address,
  };
  console.log(JSON.stringify(out));

  // Optional local file
  fs.writeFileSync("addresses.json", JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
