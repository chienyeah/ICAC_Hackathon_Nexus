import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main(){
  const tokenAddr = process.env.TOKEN!;
  const prizeAddr = process.env.PRIZE!;
  if(!tokenAddr || !prizeAddr) throw new Error("TOKEN/PRIZE missing in .env");
  const [admin, w1, w2] = await ethers.getSigners();
  const token = await ethers.getContractAt("DemoToken", tokenAddr);
  const prize = await ethers.getContractAt("PrizePool", prizeAddr);

  await (await token.approve(prizeAddr, ethers.parseEther("1000"))).wait();
  await (await prize.createPool(tokenAddr, ethers.parseEther("1000"))).wait();
  await (await prize.verifyResults(1)).wait();
  await (await prize.release(
    1,
    [w1.address, w2.address],
    [ethers.parseEther("300"), ethers.parseEther("700")]
  )).wait();

  console.log("Seeded prize pool #1 → 300/700");
}
main().catch((e)=>{ console.error(e); process.exit(1); });
