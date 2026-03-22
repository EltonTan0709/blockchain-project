-- CreateTable
CREATE TABLE "PrismaSetup" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrismaSetup_pkey" PRIMARY KEY ("id")
);
