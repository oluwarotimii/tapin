-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'ZKTeco device',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "lastStamp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevicePunch" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "punchedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT '',
    "verifyMode" TEXT NOT NULL DEFAULT '',
    "workCode" TEXT NOT NULL DEFAULT '',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevicePunch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_serial_key" ON "Device"("serial");

-- CreateIndex
CREATE INDEX "DevicePunch_deviceId_punchedAt_idx" ON "DevicePunch"("deviceId", "punchedAt");

-- CreateIndex
CREATE INDEX "DevicePunch_punchedAt_idx" ON "DevicePunch"("punchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DevicePunch_deviceId_pin_punchedAt_key" ON "DevicePunch"("deviceId", "pin", "punchedAt");

-- AddForeignKey
ALTER TABLE "DevicePunch" ADD CONSTRAINT "DevicePunch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
