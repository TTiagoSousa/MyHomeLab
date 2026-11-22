import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoryDto } from './dto/reorder-category.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';

@Controller('category')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  create(
    @Body() dto: CreateCategoryDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.categoryService.create(dto, req.user.id);
  }

  @Get()
  findAll(@Req() req: Request & { user: JwtPayload }) {
    return this.categoryService.findAll(req.user.id);
  }

  @Get('with-services')
  findAllWithServices(@Req() req: Request & { user: JwtPayload }) {
    return this.categoryService.findAllWithServices(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request & { user: JwtPayload }) {
    return this.categoryService.findOne(id, req.user.id);
  }

  @Patch('reorder')
  reorder(
    @Body() dto: ReorderCategoryDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.categoryService.reorder(dto, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.categoryService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() req: Request & { user: JwtPayload }) {
    return this.categoryService.remove(id, req.user.id);
  }
}
