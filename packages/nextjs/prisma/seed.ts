import { FlightStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const adminWallet = "0x9c20E1097fE79E1E0942d00283E38326489d507b";

const sampleFlights = [
  {
    flightNumber: "SQ318",
    departureAirport: "SIN",
    arrivalAirport: "LHR",
    scheduledDeparture: new Date("2026-03-24T23:45:00.000Z"),
    scheduledArrival: new Date("2026-03-25T06:15:00.000Z"),
    currentStatus: FlightStatus.SCHEDULED,
    statusUpdates: [
      {
        status: FlightStatus.SCHEDULED,
        note: "On schedule for departure.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-22T09:00:00.000Z"),
      },
    ],
  },
  {
    flightNumber: "BA12",
    departureAirport: "SIN",
    arrivalAirport: "LHR",
    scheduledDeparture: new Date("2026-03-23T15:10:00.000Z"),
    scheduledArrival: new Date("2026-03-23T22:05:00.000Z"),
    currentStatus: FlightStatus.DELAYED,
    statusUpdates: [
      {
        status: FlightStatus.SCHEDULED,
        note: "Initial schedule published.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-21T07:30:00.000Z"),
      },
      {
        status: FlightStatus.DELAYED,
        note: "Departure delayed by 90 minutes due to late inbound aircraft.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-23T12:45:00.000Z"),
      },
    ],
  },
  {
    flightNumber: "UA1",
    departureAirport: "SFO",
    arrivalAirport: "SIN",
    scheduledDeparture: new Date("2026-03-23T06:55:00.000Z"),
    scheduledArrival: new Date("2026-03-24T01:20:00.000Z"),
    currentStatus: FlightStatus.CANCELLED,
    statusUpdates: [
      {
        status: FlightStatus.SCHEDULED,
        note: "Initial schedule published.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-20T18:00:00.000Z"),
      },
      {
        status: FlightStatus.CANCELLED,
        note: "Cancelled because of operational constraints.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-22T22:15:00.000Z"),
      },
    ],
  },
  {
    flightNumber: "EK405",
    departureAirport: "MEL",
    arrivalAirport: "DXB",
    scheduledDeparture: new Date("2026-03-22T12:15:00.000Z"),
    scheduledArrival: new Date("2026-03-22T20:45:00.000Z"),
    currentStatus: FlightStatus.DEPARTED,
    statusUpdates: [
      {
        status: FlightStatus.SCHEDULED,
        note: "Boarding plan finalized.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-21T23:30:00.000Z"),
      },
      {
        status: FlightStatus.DEPARTED,
        note: "Aircraft departed and en route.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-22T12:32:00.000Z"),
      },
    ],
  },
  {
    flightNumber: "NH802",
    departureAirport: "SIN",
    arrivalAirport: "NRT",
    scheduledDeparture: new Date("2026-03-21T14:05:00.000Z"),
    scheduledArrival: new Date("2026-03-21T22:10:00.000Z"),
    currentStatus: FlightStatus.ARRIVED,
    statusUpdates: [
      {
        status: FlightStatus.DEPARTED,
        note: "Flight departed on time.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-21T14:12:00.000Z"),
      },
      {
        status: FlightStatus.ARRIVED,
        note: "Flight arrived at destination.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-21T22:03:00.000Z"),
      },
    ],
  },
  {
    flightNumber: "QF72",
    departureAirport: "SIN",
    arrivalAirport: "PER",
    scheduledDeparture: new Date("2026-03-24T02:10:00.000Z"),
    scheduledArrival: new Date("2026-03-24T07:25:00.000Z"),
    currentStatus: FlightStatus.SCHEDULED,
    statusUpdates: [
      {
        status: FlightStatus.SCHEDULED,
        note: "Check-in opened.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-22T08:00:00.000Z"),
      },
    ],
  },
  {
    flightNumber: "LH779",
    departureAirport: "SIN",
    arrivalAirport: "FRA",
    scheduledDeparture: new Date("2026-03-22T15:55:00.000Z"),
    scheduledArrival: new Date("2026-03-22T23:10:00.000Z"),
    currentStatus: FlightStatus.DELAYED,
    statusUpdates: [
      {
        status: FlightStatus.SCHEDULED,
        note: "Initial departure schedule confirmed.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-21T16:00:00.000Z"),
      },
      {
        status: FlightStatus.DELAYED,
        note: "Departure delayed due to weather near destination.",
        updatedByWallet: adminWallet,
        createdAt: new Date("2026-03-22T14:40:00.000Z"),
      },
    ],
  },
] as const;

async function main() {
  await prisma.flightStatusUpdate.deleteMany();
  await prisma.flight.deleteMany();

  for (const flight of sampleFlights) {
    await prisma.flight.create({
      data: {
        flightNumber: flight.flightNumber,
        departureAirport: flight.departureAirport,
        arrivalAirport: flight.arrivalAirport,
        scheduledDeparture: flight.scheduledDeparture,
        scheduledArrival: flight.scheduledArrival,
        currentStatus: flight.currentStatus,
        statusUpdates: {
          create: flight.statusUpdates.map(statusUpdate => ({
            status: statusUpdate.status,
            note: statusUpdate.note,
            updatedByWallet: statusUpdate.updatedByWallet,
            createdAt: statusUpdate.createdAt,
          })),
        },
      },
    });
  }
}

main()
  .catch(error => {
    console.error("Prisma seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
