import { FlightStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const adminWallet = "0x9c20E1097fE79E1E0942d00283E38326489d507b";
const scheduledDeparture = new Date("2027-04-02T10:20:00.000Z");
const scheduledArrival = new Date("2027-04-02T14:15:00.000Z");

async function main() {
  const existingFlight = await prisma.flight.findUnique({
    where: {
      flightNumber_scheduledDeparture: {
        flightNumber: "CX715",
        scheduledDeparture,
      },
    },
  });

  if (existingFlight) {
    await prisma.$transaction(async tx => {
      await tx.flightStatusUpdate.deleteMany({
        where: {
          flightId: existingFlight.id,
        },
      });

      await tx.flight.update({
        where: { id: existingFlight.id },
        data: {
          departureAirport: "SIN",
          arrivalAirport: "HKG",
          scheduledArrival,
          currentStatus: FlightStatus.SCHEDULED,
          statusUpdates: {
            create: [
              {
                status: FlightStatus.SCHEDULED,
                note: "Initial departure schedule confirmed.",
                updatedByWallet: adminWallet,
                createdAt: new Date("2027-04-01T08:00:00.000Z"),
              },
              {
                status: FlightStatus.DELAYED,
                note: "Departure delayed by 45 minutes due to crew rotation.",
                updatedByWallet: adminWallet,
                createdAt: new Date("2027-04-02T09:35:00.000Z"),
              },
            ],
          },
        },
      });
    });
  } else {
    await prisma.flight.create({
      data: {
        flightNumber: "CX715",
        departureAirport: "SIN",
        arrivalAirport: "HKG",
        scheduledDeparture,
        scheduledArrival,
        currentStatus: FlightStatus.SCHEDULED,
        statusUpdates: {
          create: [
            {
              status: FlightStatus.SCHEDULED,
              note: "Initial departure schedule confirmed.",
              updatedByWallet: adminWallet,
              createdAt: new Date("2027-04-01T08:00:00.000Z"),
            },
            {
              status: FlightStatus.DELAYED,
              note: "Departure delayed by 45 minutes due to crew rotation.",
              updatedByWallet: adminWallet,
              createdAt: new Date("2027-04-02T09:35:00.000Z"),
            },
          ],
        },
      },
    });
  }

  console.log("Seeded split-vote showcase flight CX715.");
}

main()
  .catch(error => {
    console.error("Split-vote seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
