/*
  Warnings:

  - Made the column `ipfsCid` on table `Transfer` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transfer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "txHash" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "fromClub" TEXT NOT NULL,
    "toClub" TEXT NOT NULL,
    "feeWei" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "agentFeeWei" TEXT NOT NULL,
    "docSha256" TEXT NOT NULL,
    "ipfsCid" TEXT NOT NULL,
    "ts" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Transfer" ("agent", "agentFeeWei", "docSha256", "feeWei", "fromClub", "id", "ipfsCid", "playerId", "toClub", "ts", "txHash") SELECT "agent", "agentFeeWei", "docSha256", "feeWei", "fromClub", "id", "ipfsCid", "playerId", "toClub", "ts", "txHash" FROM "Transfer";
DROP TABLE "Transfer";
ALTER TABLE "new_Transfer" RENAME TO "Transfer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
