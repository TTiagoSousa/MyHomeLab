import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AiCredentialService } from 'src/ai-credential/ai-credential.service';
import { aiFailure } from 'src/ai-credential/ai-providers';
import { Meal } from 'src/generated/prisma/client/client';
import { SaveMealDto } from './dto/save-health-logs.dto';
import { estimateMeal, MealImage } from './ai/estimateMeal';
import { localDayDate } from './helpers/localDayDate';
import { dayOf } from './helpers/dayOf';
import { nutritionDays } from './helpers/nutritionDays';
import { requireAnthropic } from './helpers/requireAnthropic';
import { roundTo } from './helpers/readings';

const DAY_MS = 24 * 60 * 60 * 1000;

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/;

const toMealView = (meal: Omit<Meal, 'photo'> & { photo?: unknown }) => ({
  id: meal.id,
  at: meal.at,
  day: dayOf(meal.day),
  timeZone: meal.timeZone,
  mealType: meal.mealType,
  text: meal.text,
  kcal: meal.kcal,
  proteinG: meal.proteinG,
  carbsG: meal.carbsG,
  fatG: meal.fatG,
  estimated: meal.estimated,
  hasPhoto: Boolean(meal.photoMime),
});

const average = (values: number[]) =>
  values.length
    ? roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, 1)
    : null;

/** Sem a foto: só se lê quando se abre. */
const MEAL_SELECT = {
  id: true,
  userId: true,
  at: true,
  day: true,
  timeZone: true,
  mealType: true,
  text: true,
  kcal: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
  estimated: true,
  photoMime: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * A alimentação: refeições (com estimativa de calorias e macros pelo Claude),
 * café, álcool e suplementos. Os períodos contam a partir de hoje.
 */
@Injectable()
export class NutritionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCredentials: AiCredentialService,
  ) {}

  async nutrition(userId: string, days: number) {
    const since =
      days > 0 ? { gte: new Date(Date.now() - days * DAY_MS) } : undefined;
    const [meals, intakes] = await Promise.all([
      this.prisma.meal.findMany({
        where: { userId, ...(since ? { at: since } : {}) },
        orderBy: { at: 'desc' },
        select: MEAL_SELECT,
      }),
      this.prisma.intakeEntry.findMany({
        where: { userId, ...(since ? { at: since } : {}) },
        orderBy: { at: 'desc' },
      }),
    ]);

    const perDay = nutritionDays(meals, intakes);
    const withMeals = perDay.filter((day) => day.meals > 0);

    return {
      meals: meals.map(toMealView),
      days: perDay,
      averages: {
        days: withMeals.length,
        kcal: average(withMeals.map((day) => day.kcal)),
        proteinG: average(withMeals.map((day) => day.proteinG)),
        carbsG: average(withMeals.map((day) => day.carbsG)),
        fatG: average(withMeals.map((day) => day.fatG)),
        caffeineMg: average(perDay.map((day) => day.caffeineMg)),
        alcoholUnits: average(perDay.map((day) => day.alcoholUnits)),
      },
    };
  }

  async estimate(userId: string, text: string, image?: MealImage | null) {
    if (image && !IMAGE_TYPES.test(image.mimetype)) {
      throw new BadRequestException({
        code: 'HEALTH_IMAGE_TYPE',
        message: 'A foto tem de ser JPG, PNG, WebP ou GIF.',
      });
    }
    const anthropic = await requireAnthropic(this.aiCredentials, userId);
    try {
      return await estimateMeal(anthropic, text.trim(), image);
    } catch (error) {
      throw aiFailure(error) ?? error;
    }
  }

  async createMeal(userId: string, dto: SaveMealDto) {
    const meal = await this.prisma.meal.create({
      data: { userId, ...this.mealData(dto) },
      select: MEAL_SELECT,
    });
    return toMealView(meal);
  }

  async updateMeal(userId: string, id: string, dto: SaveMealDto) {
    await this.findMeal(userId, id);
    const meal = await this.prisma.meal.update({
      where: { id },
      data: this.mealData(dto),
      select: MEAL_SELECT,
    });
    return toMealView(meal);
  }

  async removeMeal(userId: string, id: string) {
    await this.findMeal(userId, id);
    await this.prisma.meal.delete({ where: { id } });
    return { deleted: true };
  }

  async attachPhoto(
    userId: string,
    id: string,
    file?: { buffer: Buffer; mimetype: string },
  ) {
    await this.findMeal(userId, id);
    if (!file?.buffer?.length || !IMAGE_TYPES.test(file.mimetype)) {
      throw new BadRequestException({
        code: 'HEALTH_IMAGE_TYPE',
        message: 'A foto tem de ser JPG, PNG, WebP ou GIF.',
      });
    }
    await this.prisma.meal.update({
      where: { id },
      data: { photo: new Uint8Array(file.buffer), photoMime: file.mimetype },
    });
    return { attached: true };
  }

  async photo(userId: string, id: string) {
    const meal = await this.prisma.meal.findFirst({
      where: { id, userId },
      select: { photo: true, photoMime: true },
    });
    if (!meal?.photo || !meal.photoMime)
      throw new NotFoundException('Esta refeição não tem foto');
    return { buffer: Buffer.from(meal.photo), mime: meal.photoMime };
  }

  private mealData(dto: SaveMealDto) {
    const at = new Date(dto.at);
    return {
      at,
      day: localDayDate(at, dto.timeZone),
      timeZone: dto.timeZone,
      mealType: dto.mealType,
      text: dto.text.trim(),
      kcal: dto.kcal ?? null,
      proteinG: dto.proteinG ?? null,
      carbsG: dto.carbsG ?? null,
      fatG: dto.fatG ?? null,
      estimated: dto.estimated ?? false,
    };
  }

  private async findMeal(userId: string, id: string) {
    const meal = await this.prisma.meal.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!meal) throw new NotFoundException('Refeição não encontrada');
  }
}
