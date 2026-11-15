import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HeartRateService } from './heart-rate.service';
import { SkinTemperatureService } from './skin-temperature.service';
import { BloodOxygenService } from './blood-oxygen.service';
import { StressService } from './stress.service';
import { ExerciseService } from './exercise.service';
import { StepsService } from './steps.service';
import { WeightService } from './weight.service';
import { WaterService } from './water.service';
import { LabsService } from './labs.service';
import { HealthRecordsService } from './health-records.service';
import { HealthRecordsController } from './health-records.controller';
import { NutritionService } from './nutrition.service';
import { NutritionController } from './nutrition.controller';
import { BodyService } from './body.service';
import { BodyController } from './body.controller';
import { WellbeingService } from './wellbeing.service';
import { WellbeingController } from './wellbeing.controller';
import { MedicalService } from './medical.service';
import { MedicalController } from './medical.controller';
import { IntakesService } from './intakes.service';
import { IntakesController } from './intakes.controller';
import { OpenGymController } from './opengym/opengym.controller';
import { OpenGymService } from './opengym/opengym.service';
import { OpenGymScheduler } from './opengym/opengym.scheduler';
import { HealthRemindersService } from './health-reminders.service';
import { AiCredentialModule } from 'src/ai-credential/ai-credential.module';
import { NotificationModule } from 'src/notification/notification.module';
import { HealthReminderScheduler } from './health-reminder.scheduler';

@Module({
  imports: [AiCredentialModule, NotificationModule],
  controllers: [
    HealthController,
    HealthRecordsController,
    NutritionController,
    BodyController,
    WellbeingController,
    MedicalController,
    IntakesController,
    OpenGymController,
  ],
  providers: [
    HealthService,
    HeartRateService,
    SkinTemperatureService,
    BloodOxygenService,
    StressService,
    ExerciseService,
    StepsService,
    WeightService,
    WaterService,
    LabsService,
    HealthRecordsService,
    NutritionService,
    BodyService,
    WellbeingService,
    MedicalService,
    IntakesService,
    OpenGymService,
    OpenGymScheduler,
    HealthRemindersService,
    HealthReminderScheduler,
  ],
  exports: [
    HealthService,
    HeartRateService,
    SkinTemperatureService,
    BloodOxygenService,
    StressService,
    ExerciseService,
    StepsService,
    WeightService,
    WaterService,
    LabsService,
    HealthRecordsService,
    NutritionService,
    BodyService,
    WellbeingService,
    MedicalService,
    IntakesService,
    OpenGymService,
    HealthRemindersService,
  ],
})
export class HealthModule {}
