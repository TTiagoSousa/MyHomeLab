import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MeasurementDeviceKind } from 'src/generated/prisma/client/client';

/**
 * O aparelho de um registo: o pedido (tem de ser do utilizador), o predefinido
 * do tipo quando não vem nenhum, ou nenhum quando vem null.
 */
export async function deviceFor(
  prisma: PrismaService,
  userId: string,
  deviceId: string | null | undefined,
  kind: MeasurementDeviceKind,
) {
  if (deviceId === null) return null;
  const device = await prisma.measurementDevice.findFirst({
    where: deviceId
      ? { id: deviceId, userId }
      : { userId, kind, isDefault: true },
    select: { id: true },
  });
  if (deviceId && !device)
    throw new NotFoundException('Aparelho não encontrado');
  return device?.id ?? null;
}
