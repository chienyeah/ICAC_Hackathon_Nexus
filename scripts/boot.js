// scripts/boot.js
// One-click launcher that SKIPS deploy + writing envs.
// It assumes .env and web/.env already contain valid addresses.
//
// Required in ROOT .env:
// RPC_URL, ROLES, TOKEN, TRANSFER, PRIZE, SPONSOR, DISCIPLINARY
//
// Required in web/.env:
// VITE_ROLES, VITE_TOKEN, VITE_TRANSFER, VITE_PRIZE, VITE_SPONSOR, VITE_DISCIPLINARY

const { spawn, exec } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
require("dotenv").config(); // load ROOT .env so seed/prisma can read it

const ROOT = process.cwd();
const WEB = path.join(ROOT, "web");
const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function rpcReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise(async (resolve, reject) => {
    while (Date.now() < deadline) {
      try {
        await new Promise((res, rej) => {
          const req = http.request(rpcUrl, { method: "POST" }, (res2) => {
            res2.on("data", ()=>{});
            res2.on("end", res);
          });
          req.on("error", rej);
          req.write(JSON.stringify({ jsonrpc:"2.0", id:1, method:"eth_chainId", params:[] }));
          req.end();
        });
        return resolve(true);
      } catch (e) { /* retry */ }
      await wait(800);
    }
    reject(new Error("RPC not responding at " + rpcUrl));
  });
}

function run(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { shell: true, ...opts }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

function spawnForever(cmd, cwd = ROOT) {
  const p = spawn(cmd, { cwd, shell: true, stdio: "inherit" });
  p.on("exit", (code) => console.log(`[${cmd}] exited ${code}`));
  return p;
}

// --- helpers to validate existing envs ---
function mustHex(name, v) {
  if (!v || !/^0x[0-9a-fA-F]{40}$/.test(v)) {
    throw new Error(`Missing/invalid ${name}. Got: ${JSON.stringify(v)}`);
  }
  return v;
}
function validateRootEnv() {
  const req = ["ROLES","TOKEN","TRANSFER","PRIZE","SPONSOR","DISCIPLINARY"];
  req.forEach(k => mustHex(k, process.env[k]));
  console.log("Using addresses from existing .env:");
  console.table({
    ROLES: process.env.ROLES,
    TOKEN: process.env.TOKEN,
    TRANSFER: process.env.TRANSFER,
    PRIZE: process.env.PRIZE,
    SPONSOR: process.env.SPONSOR,
    DISCIPLINARY: process.env.DISCIPLINARY
  });
}
function validateWebEnv() {
  const webEnvPath = path.join(WEB, ".env");
  if (!fs.existsSync(webEnvPath)) {
    console.warn("web/.env not found. UI may not connect to the right contracts.");
    return;
  }
  const webEnvRaw = fs.readFileSync(webEnvPath, "utf-8");
  const get = (k) => (webEnvRaw.match(new RegExp(`^${k}=.*$`, "m")) || [])[0]?.split("=")[1]?.trim();
  ["VITE_ROLES","VITE_TOKEN","VITE_TRANSFER","VITE_PRIZE","VITE_SPONSOR","VITE_DISCIPLINARY"].forEach(k=>{
    const v = get(k);
    if (!v || !/^0x[0-9a-fA-F]{40}$/.test(v)) {
      console.warn(`web/.env missing or invalid ${k}. Got: ${v}`);
    }
  });
}

(async function main() {
  console.log("1) Start Hardhat node...");
  const chain = spawnForever("npx hardhat node");

  console.log("2) Wait for RPC...");
  await rpcReady();

  // -------------------------------
  // 3) Deploy contracts (SKIPPED)
  //    const { stdout: deployOut } = await run("npx hardhat run scripts/deploy.ts --network localhost");
  //    const addresses = JSON.parse(deployOut);
  //    console.log("Deployed:", addresses);

  // 4) Write .env files (SKIPPED)
  //    (We assume .env and web/.env are already set with the addresses you want to use)
  // -------------------------------

  // Validate that .env & web/.env already have addresses
  validateRootEnv();
  validateWebEnv();

async function prismaGenerateWithRetry() {
  try {
    await run("npx prisma generate");
  } catch (e) {
    console.warn("prisma generate failed; cleaning cache & retrying...", e.message);
    // Windows-safe delete of Prisma cache
    try { await run('powershell -NoProfile -Command "Remove-Item -Recurse -Force .\\node_modules\\.prisma"'); } catch {}
    try { await run('powershell -NoProfile -Command "Remove-Item -Recurse -Force .\\node_modules\\@prisma\\engines"'); } catch {}
    await wait(1500);
    await run("npx prisma generate");
  }
}

console.log("5) Prisma generate & sync DB...");
await prismaGenerateWithRetry();
await run("npx prisma db push");

  console.log("5) Prisma generate & sync DB...");
  await run("npx prisma db push");

  console.log("6) Seed demo data (uses TOKEN/PRIZE from .env)...");
  await run("npx hardhat run scripts/seed.ts --network localhost").catch((e)=>{
    console.warn("Seed failed (continuing):", e.message);
  });

  console.log("7) Start services: indexer, API, Web...");
  const indexer = spawnForever("npx ts-node indexer/indexer.ts");
  const api = spawnForever("npx ts-node api/server.ts");
  const web = spawnForever("npm run dev", WEB);

  process.on("SIGINT", () => {
    [indexer, api, web, chain].forEach(p => { try { p.kill("SIGINT"); } catch {} });
    process.exit(0);
  });
})();
