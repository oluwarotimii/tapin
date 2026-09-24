/*
  Warnings:

  - Changed the type of `template` on the `FingerprintTemplate` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "FingerprintTemplate" DROP COLUMN "template",
ADD COLUMN     "template" BYTEA NOT NULL;
