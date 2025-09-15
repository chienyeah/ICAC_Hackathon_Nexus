import { ethers } from "hardhat";

async function main() {
  const [admin, clubA, clubB, sponsor1] = await ethers.getSigners();

  const RoleManager = await ethers.getContractFactory("RoleManager");
  const roles = await RoleManager.deploy(admin.address); await roles.waitForDeployment();

  const DemoToken = await ethers.getContractFactory("DemoToken");
  const token = await DemoToken.deploy(); await token.waitForDeployment();

  const TransferRegistry = await ethers.getContractFactory("TransferRegistry");
  const transfer = await TransferRegistry.deploy(await roles.getAddress()); await transfer.waitForDeployment();

  const PrizePool = await ethers.getContractFactory("PrizePool");
  const prize = await PrizePool.deploy(await roles.getAddress()); await prize.waitForDeployment();

  const SponsorshipRegistry = await ethers.getContractFactory("SponsorshipRegistry");
  const sponsorship = await SponsorshipRegistry.deploy(await roles.getAddress()); await sponsorship.waitForDeployment();

  const DisciplinaryRegistry = await ethers.getContractFactory("DisciplinaryRegistry");
  const disciplinary = await DisciplinaryRegistry.deploy(await roles.getAddress()); await disciplinary.waitForDeployment();

  // Grant roles for demo
  await roles.grantRole(await roles.CLUB_ROLE(), clubA.address);
  await roles.grantRole(await roles.CLUB_ROLE(), clubB.address);
  await roles.grantRole(await roles.SPONSOR_ROLE(), sponsor1.address);

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
    admin: admin.address
  };
  // print ONLY JSON:
  console.log(JSON.stringify(out));
}
main().catch((e)=>{ console.error(e); process.exit(1); });
