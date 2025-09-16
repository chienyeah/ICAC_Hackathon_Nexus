import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [admin] = await ethers.getSigners();

  const roles = await ethers.getContractAt("RoleManager", process.env.ROLES!, admin);
  const transfer = await ethers.getContractAt("TransferRegistry", process.env.TRANSFER!, admin);
  const prize = await ethers.getContractAt("PrizePool", process.env.PRIZE!, admin);
  const sponsor = await ethers.getContractAt("SponsorshipRegistry", process.env.SPONSOR!, admin);
  const disc = await ethers.getContractAt("DisciplinaryRegistry", process.env.DISCIPLINARY!, admin);

  const tryUnpause = async (c: any, name: string) => {
    try { await (await c.unpause()).wait(); console.log(`Unpaused ${name}`); }
    catch (e:any) { if (!/paused|Ownable|AccessControl/.test(String(e))) console.log(`Skip ${name}:`, e.message || e); }
  };

  await tryUnpause(transfer, "TransferRegistry");
  await tryUnpause(prize, "PrizePool");
  await tryUnpause(sponsor, "SponsorshipRegistry");
  await tryUnpause(disc, "DisciplinaryRegistry");

  const CLUB_ROLE = await roles.CLUB_ROLE();
  const SPONSOR_ROLE = await roles.SPONSOR_ROLE();
  const transferClubRole = await transfer.CLUB_ROLE();

  await (await roles.grantRole(CLUB_ROLE, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")).wait();
  await (await roles.grantRole(CLUB_ROLE, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC")).wait();
  await (await roles.grantRole(SPONSOR_ROLE, "0x90F79bf6EB2c4f870365E785982E1f101E93b906")).wait();

  await (await transfer.grantRole(transferClubRole, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")).wait();
  await (await transfer.grantRole(transferClubRole, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC")).wait();

  console.log("Roles regranted & unpaused.");
}

main().catch((e)=>{ console.error(e); process.exit(1); });
