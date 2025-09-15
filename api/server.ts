import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors()); app.use(bodyParser.json({ limit: "10mb" }));
const prisma = new PrismaClient();

// Upload a file (Base64) -> return sha256 and (optionally) store to IPFS later
app.post("/hash-file", async (req, res) => {
  const { base64 } = req.body as { base64: string };
  const buf = Buffer.from(base64, "base64");
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  res.json({ sha256: "0x"+sha });
});

app.get("/transfers", async (_, res) => res.json(await prisma.transfer.findMany({ orderBy: { id: "desc" } })));
app.get("/prizes",    async (_, res) => res.json(await prisma.prizeRelease.findMany({ orderBy: { id: "desc" } })));
app.get("/sponsors",  async (_, res) => res.json(await prisma.sponsorship.findMany({ orderBy: { id: "desc" } })));
app.get("/sanctions", async (_, res) => res.json(await prisma.sanction.findMany({ orderBy: { id: "desc" } })));

app.listen(4000, ()=> console.log("API on http://localhost:4000"));
