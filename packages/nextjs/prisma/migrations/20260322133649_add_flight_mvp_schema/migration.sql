/*
  Warnings:

  - You are about to drop the `PrismaSetup` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('SCHEDULED', 'DELAYED', 'CANCELLED', 'DEPARTED', 'ARRIVED');

-- DropTable
DROP TABLE "public"."PrismaSetup";

-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "departureAirport" TEXT NOT NULL,
    "arrivalAirport" TEXT NOT NULL,
    "scheduledDeparture" TIMESTAMP(3) NOT NULL,
    "scheduledArrival" TIMESTAMP(3) NOT NULL,
    "currentStatus" "FlightStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightStatusUpdate" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "status" "FlightStatus" NOT NULL,
    "note" TEXT,
    "updatedByWallet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightStatusUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Flight_flightNumber_idx" ON "Flight"("flightNumber");

-- CreateIndex
CREATE INDEX "Flight_currentStatus_idx" ON "Flight"("currentStatus");

-- CreateIndex
CREATE INDEX "Flight_scheduledDeparture_idx" ON "Flight"("scheduledDeparture");

-- CreateIndex
CREATE UNIQUE INDEX "Flight_flightNumber_scheduledDeparture_key" ON "Flight"("flightNumber", "scheduledDeparture");

-- CreateIndex
CREATE INDEX "FlightStatusUpdate_flightId_createdAt_idx" ON "FlightStatusUpdate"("flightId", "createdAt");

-- CreateIndex
CREATE INDEX "FlightStatusUpdate_status_createdAt_idx" ON "FlightStatusUpdate"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "FlightStatusUpdate" ADD CONSTRAINT "FlightStatusUpdate_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
