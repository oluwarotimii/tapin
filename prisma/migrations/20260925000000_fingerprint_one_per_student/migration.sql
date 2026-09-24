-- One fingerprint per student: replace the plain index with a unique one.
DROP INDEX "FingerprintTemplate_studentId_idx";

-- AlterTable
CREATE UNIQUE INDEX "FingerprintTemplate_studentId_key" ON "FingerprintTemplate"("studentId");
