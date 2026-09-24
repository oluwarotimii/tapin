-- AlterEnum
ALTER TYPE "ApiKeyScope" ADD VALUE 'fingerprints_write';

-- AlterTable
ALTER TABLE "ActiveSession" ALTER COLUMN "cardId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "FingerprintTemplate" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "finger" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FingerprintTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FingerprintTemplate_studentId_idx" ON "FingerprintTemplate"("studentId");

-- AddForeignKey
ALTER TABLE "FingerprintTemplate" ADD CONSTRAINT "FingerprintTemplate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
