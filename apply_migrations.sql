-- ============================================================
-- Migration 1/5: 20260806132359_init
-- ============================================================
-- CreateEnum
CREATE TYPE "ApiKeyScope" AS ENUM ('students_read', 'students_write', 'schedules_read', 'schedules_write', 'attendance_read', 'attendance_write', 'taps_write', 'cards_write');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('complete', 'incomplete', 'in_progress');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" "ApiKeyScope"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'active',
    "cardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDay" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "minimumMinutes" INTEGER NOT NULL,
    "studentId" TEXT,

    CONSTRAINT "ScheduleDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clockIn" TEXT NOT NULL,
    "clockOut" TEXT,
    "durationMinutes" INTEGER,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'in_progress',
    "override" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'tap',

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "clockedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_cardId_key" ON "Student"("cardId");

-- CreateIndex
CREATE INDEX "ScheduleDay_studentId_idx" ON "ScheduleDay"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDay_day_start_end_minimumMinutes_studentId_key" ON "ScheduleDay"("day", "start", "end", "minimumMinutes", "studentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_date_idx" ON "AttendanceRecord"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_date_key" ON "AttendanceRecord"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveSession_studentId_key" ON "ActiveSession"("studentId");

-- AddForeignKey
ALTER TABLE "ScheduleDay" ADD CONSTRAINT "ScheduleDay_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveSession" ADD CONSTRAINT "ActiveSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Migration 2/5: 20260924140130_add_fingerprint_templates
-- ============================================================
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

-- ============================================================
-- Migration 3/5: 20260924164724_fingerprint_template_bytea
-- ============================================================
ALTER TABLE "FingerprintTemplate" DROP COLUMN "template",
ADD COLUMN     "template" BYTEA NOT NULL;

-- ============================================================
-- Migration 4/5: 20260925000000_fingerprint_one_per_student
-- ============================================================
DROP INDEX "FingerprintTemplate_studentId_idx";

CREATE UNIQUE INDEX "FingerprintTemplate_studentId_key" ON "FingerprintTemplate"("studentId");

-- ============================================================
-- Migration 5/5: 20261001095219_add_app_settings
-- ============================================================
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- ============================================================
-- Prisma's own migration-tracking table, with all 5 marked
-- as applied, so a future `node migrate.cjs` run recognizes
-- them and doesn't try to re-apply or report drift.
-- ============================================================
CREATE TABLE "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count") VALUES
  (gen_random_uuid()::text, '39c24644e5b5dc089ba2ddd25e7be96631f316c46d28d64393bcebb44ed8a0fb', now(), '20260806132359_init', now(), 1),
  (gen_random_uuid()::text, '02303994d381660cbdb0114dec58ccb4abef9eee16cbcbbb4ddea08692af4c44', now(), '20260924140130_add_fingerprint_templates', now(), 1),
  (gen_random_uuid()::text, '67c05ab71a7523083eb7b58781a684cb2966545b135752d7775ea9e2e3916811', now(), '20260924164724_fingerprint_template_bytea', now(), 1),
  (gen_random_uuid()::text, '25c7f4aad6f55f56637cf8af5de201438f0d9d86df223d602a6d7fcde8496da6', now(), '20260925000000_fingerprint_one_per_student', now(), 1),
  (gen_random_uuid()::text, '82501b77976973bd364ee261325ff946d38c4440409980c6e425e65a5ef81911', now(), '20261001095219_add_app_settings', now(), 1);
