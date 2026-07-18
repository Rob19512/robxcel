"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "singleton";

export async function getAppSettings() {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
  return {
    tvaAssujettiDepuis: settings.tvaAssujettiDepuis ? settings.tvaAssujettiDepuis.toISOString().slice(0, 10) : null,
  };
}

export async function updateTvaAssujettiDepuis(value: string | null) {
  const date = value ? new Date(`${value}T00:00:00.000Z`) : null;
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { tvaAssujettiDepuis: date },
    create: { id: SETTINGS_ID, tvaAssujettiDepuis: date },
  });
  revalidatePath("/tva");
}
