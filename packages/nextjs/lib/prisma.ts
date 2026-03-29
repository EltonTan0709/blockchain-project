import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const getPrismaClientOptions = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(databaseUrl);
    const isSupabasePooler = parsedUrl.hostname.includes(".pooler.supabase.com");
    const configuredConnectionLimit = process.env.PRISMA_CONNECTION_LIMIT;

    if (configuredConnectionLimit && !parsedUrl.searchParams.has("connection_limit")) {
      parsedUrl.searchParams.set("connection_limit", configuredConnectionLimit);
    } else if (isSupabasePooler && !parsedUrl.searchParams.has("connection_limit")) {
      // Keep local Next.js + worker usage gentle on the Supabase pooler.
      parsedUrl.searchParams.set("connection_limit", "1");
    }

    return {
      datasources: {
        db: {
          url: parsedUrl.toString(),
        },
      },
    };
  } catch {
    return undefined;
  }
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient(getPrismaClientOptions());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
