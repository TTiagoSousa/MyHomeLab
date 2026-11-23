import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TodayShortcutKind } from 'src/generated/prisma/client/client';
import { CreateShortcutDto } from './dto/create-shortcut.dto';
import { geocodeCity } from './helpers/geocodeCity';
import { Forecast, fetchForecast } from './helpers/fetchForecast';

const FORECAST_TTL_MS = 15 * 60_000;

const SHORTCUT_VIEW = {
  id: true,
  kind: true,
  label: true,
  url: true,
  account: { select: { id: true, provider: true, displayName: true } },
} as const;

/** A página Hoje: os atalhos (apps ligadas, regras de email, links) e o tempo da cidade escolhida. */
@Injectable()
export class TodayService {
  /** O tempo pedido há pouco, por utilizador: o Open-Meteo atualiza de 15 em 15 minutos. */
  private readonly forecasts = new Map<
    string,
    { at: number; key: string; forecast: Forecast }
  >();

  constructor(private readonly prisma: PrismaService) {}

  shortcuts(userId: string) {
    return this.prisma.todayShortcut.findMany({
      where: { userId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: SHORTCUT_VIEW,
    });
  }

  async addShortcut(userId: string, dto: CreateShortcutDto) {
    if (dto.kind === TodayShortcutKind.APP) {
      const account = await this.prisma.connectedAccount.findFirst({
        where: { id: dto.accountId, userId },
        select: { id: true },
      });
      if (!account) throw new NotFoundException('Essa app ligada não existe.');
    }
    if (dto.kind !== TodayShortcutKind.LINK) {
      const repeated = await this.prisma.todayShortcut.findFirst({
        where: {
          userId,
          kind: dto.kind,
          accountId: dto.kind === TodayShortcutKind.APP ? dto.accountId : null,
        },
        select: { id: true },
      });
      if (repeated) throw new ConflictException('Esse atalho já está no Hoje.');
    }
    const last = await this.prisma.todayShortcut.aggregate({
      where: { userId },
      _max: { position: true },
    });
    return this.prisma.todayShortcut.create({
      data: {
        userId,
        kind: dto.kind,
        accountId: dto.kind === TodayShortcutKind.APP ? dto.accountId : null,
        label: dto.kind === TodayShortcutKind.LINK ? dto.label?.trim() : null,
        url: dto.kind === TodayShortcutKind.LINK ? dto.url?.trim() : null,
        position: (last._max.position ?? -1) + 1,
      },
      select: SHORTCUT_VIEW,
    });
  }

  async removeShortcut(userId: string, id: string) {
    const { count } = await this.prisma.todayShortcut.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Esse atalho já não existe.');
  }

  async weather(userId: string) {
    const location = await this.prisma.weatherLocation.findUnique({
      where: { userId },
    });
    if (!location) return { location: null, forecast: null };
    const key = `${location.latitude},${location.longitude}`;
    const cached = this.forecasts.get(userId);
    if (
      cached &&
      cached.key === key &&
      Date.now() - cached.at < FORECAST_TTL_MS
    ) {
      return { location: this.place(location), forecast: cached.forecast };
    }
    try {
      const forecast = await fetchForecast(location);
      this.forecasts.set(userId, { at: Date.now(), key, forecast });
      return { location: this.place(location), forecast };
    } catch (error) {
      throw new ServiceUnavailableException(
        `Não foi possível ver o tempo agora: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async setWeather(userId: string, city: string) {
    let found: Awaited<ReturnType<typeof geocodeCity>>;
    try {
      found = await geocodeCity(city);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        `Não foi possível procurar a cidade agora: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const location = await this.prisma.weatherLocation.upsert({
      where: { userId },
      create: { userId, ...found },
      update: found,
    });
    this.forecasts.delete(userId);
    return this.place(location);
  }

  async clearWeather(userId: string) {
    await this.prisma.weatherLocation.deleteMany({ where: { userId } });
    this.forecasts.delete(userId);
  }

  private place(location: { name: string; country: string | null }) {
    return { name: location.name, country: location.country };
  }
}
