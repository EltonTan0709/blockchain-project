import { FlightStatus, Prisma } from "@prisma/client";
import "server-only";
import { prisma } from "~~/lib/prisma";

const flightWithStatusUpdatesInclude = Prisma.validator<Prisma.FlightInclude>()({
  statusUpdates: {
    orderBy: {
      createdAt: "desc",
    },
  },
});

const recentFlightStatusUpdateInclude = Prisma.validator<Prisma.FlightStatusUpdateInclude>()({
  flight: true,
});

export type FlightRecord = Prisma.FlightGetPayload<{
  include: typeof flightWithStatusUpdatesInclude;
}>;

export type FlightStatusUpdateRecord = Prisma.FlightStatusUpdateGetPayload<{
  include: typeof recentFlightStatusUpdateInclude;
}>;

export const listFlights = async (): Promise<FlightRecord[]> => {
  return prisma.flight.findMany({
    include: flightWithStatusUpdatesInclude,
    orderBy: [
      {
        scheduledDeparture: "asc",
      },
      {
        flightNumber: "asc",
      },
    ],
  });
};

export const getFlightById = async (id: string): Promise<FlightRecord | null> => {
  return prisma.flight.findUnique({
    where: { id },
    include: flightWithStatusUpdatesInclude,
  });
};

// Flight number alone is not globally unique across dates, so this returns all matches.
export const getFlightByFlightNumber = async (flightNumber: string): Promise<FlightRecord[]> => {
  return prisma.flight.findMany({
    where: {
      flightNumber: {
        equals: flightNumber.trim(),
        mode: "insensitive",
      },
    },
    include: flightWithStatusUpdatesInclude,
    orderBy: [
      {
        scheduledDeparture: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
};

export const getRecentFlightStatusUpdates = async (limit = 10): Promise<FlightStatusUpdateRecord[]> => {
  const safeLimit = Math.max(1, limit);

  return prisma.flightStatusUpdate.findMany({
    include: recentFlightStatusUpdateInclude,
    orderBy: {
      createdAt: "desc",
    },
    take: safeLimit,
  });
};

export const updateFlightStatus = async (
  flightId: string,
  newStatus: FlightStatus,
  updatedByWallet: string,
  note?: string,
): Promise<FlightRecord> => {
  const normalizedNote = note?.trim() || null;

  return prisma.$transaction(async tx => {
    await tx.flight.update({
      where: { id: flightId },
      data: {
        currentStatus: newStatus,
      },
    });

    await tx.flightStatusUpdate.create({
      data: {
        flightId,
        status: newStatus,
        note: normalizedNote,
        updatedByWallet,
      },
    });

    return tx.flight.findUniqueOrThrow({
      where: { id: flightId },
      include: flightWithStatusUpdatesInclude,
    });
  });
};

export { FlightStatus };
