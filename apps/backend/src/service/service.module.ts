import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { PrismaServiceRepository } from './repositories/prisma/prisma-service-repository';
import { CategoryModule } from 'src/category/category.module';

@Module({
  imports: [CategoryModule],
  controllers: [ServiceController],
  providers: [
    ServiceService,
    {
      provide: PrismaServiceRepository,
      useClass: PrismaServiceRepository,
    },
  ],
  exports: [PrismaServiceRepository],
})
export class ServiceModule {}
