-- CreateTable
CREATE TABLE "Transfer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "txHash" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "fromClub" TEXT NOT NULL,
    "toClub" TEXT NOT NULL,
    "feeWei" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "agentFeeWei" TEXT NOT NULL,
    "docSha256" TEXT NOT NULL,
    "ipfsCid" TEXT,
    "ts" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "PrizeRelease" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poolId" INTEGER NOT NULL,
    "toAddr" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "ts" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Sponsorship" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sponsor" TEXT NOT NULL,
    "club" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "docSha256" TEXT NOT NULL,
    "ipfsCid" TEXT,
    "ts" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Sanction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startDate" INTEGER NOT NULL,
    "endDate" INTEGER NOT NULL,
    "ts" INTEGER NOT NULL
);
