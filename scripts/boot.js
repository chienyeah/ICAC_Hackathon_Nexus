// scripts/boot.js
const { spawn, exec } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = process.cwd();
const WEB = path.join(ROOT, "web");
const rpcUrl = "http://127.0.0.1:8545";

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

function rpcReady(timeoutMs = 20000){
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
      } catch(_) {}
      await wait(600);
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

// --- NEW: helpers you were missing ---
function stripAnsi(s) { return s.replace(/\u001b\[[0-9;]*m/g, ""); }

function parseJsonFromStdout(stdout) {
  const clean = stripAnsi(String(stdout));
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("No JSON object found in deploy output");
  try {
    return JSON.parse(clean.slice(first, last + 1));
  } catch (e) {
    // fallback: try addresses.json if deploy wrote it
    const p = path.join(ROOT, "addresses.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
    throw e;
  }
}

function writeEnvs(addresses) {
  const rootEnv =
`RPC_URL=${rpcUrl}
ROLES=${addresses.roles}
TOKEN=${addresses.token}
TRANSFER=${addresses.transfer}
PRIZE=${addresses.prize}
SPONSOR=${addresses.sponsorship}
DISCIPLINARY=${addresses.disciplinary}
ADMIN=${addresses.admin}
`;
  const webEnv =
`VITE_ROLES=${addresses.roles}
VITE_TOKEN=${addresses.token}
VITE_TRANSFER=${addresses.transfer}
VITE_PRIZE=${addresses.prize}
VITE_SPONSOR=${addresses.sponsorship}
VITE_DISCIPLINARY=${addresses.disciplinary}
VITE_ADMIN=${addresses.admin}
`;
  fs.writeFileSync(path.join(ROOT, ".env"), rootEnv);
  fs.writeFileSync(path.join(WEB, ".env"), webEnv);
  console.log("Wrote .env and web/.env");
}

(async function main(){
  console.log("1) Start Hardhat node...");
  const chain = spawnForever("npx hardhat node");

  console.log("2) Wait for RPC...");
  await rpcReady();

  console.log("3) Deploy contracts...");
  const { stdout: deployOut } = await run("npx hardhat run scripts/deploy.ts --network localhost");
  const addresses = parseJsonFromStdout(deployOut);
  console.log("Deployed:", addresses);

  console.log("4) Write .env files...");
  writeEnvs(addresses);

  console.log("5) Prisma generate & db push...");
  await run("npx prisma generate");
  await run("npx prisma db push");

  console.log("6) Seed demo data...");
  await run("npx hardhat run scripts/seed.ts --network localhost").catch(e => {
    console.warn("Seed failed (continuing):", e.message);
  });

  console.log("7) Start indexer, API, web...");
  const indexer = spawnForever("npx ts-node indexer/indexer.ts");
  const api = spawnForever("npx ts-node api/server.ts");
  const web = spawnForever("npm run dev", WEB);

  process.on("SIGINT", () => {
    [indexer, api, web, chain].forEach(p => { try { p.kill("SIGINT"); } catch {} });
    process.exit(0);
  });
})();
