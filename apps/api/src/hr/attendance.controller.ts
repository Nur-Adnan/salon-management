import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type ClockIn,
  type ClockOut,
  type UpdateAttendance,
  clockInSchema,
  clockOutSchema,
  objectIdSchema,
  updateAttendanceSchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { AttendanceService } from './attendance.service.js';
import { serializeAttendanceRecord } from './mappers.js';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('clock-in')
  @HttpCode(200)
  @CheckAbility('create', 'Attendance')
  async clockIn(@Body(new ZodValidationPipe(clockInSchema)) dto: ClockIn) {
    return serializeAttendanceRecord(await this.attendance.clockIn(dto.staffId, dto.note));
  }

  @Post('clock-out')
  @HttpCode(200)
  @CheckAbility('update', 'Attendance')
  async clockOut(@Body(new ZodValidationPipe(clockOutSchema)) dto: ClockOut) {
    return serializeAttendanceRecord(await this.attendance.clockOut(dto.staffId));
  }

  @Get()
  @CheckAbility('read', 'Attendance')
  async list(@Query('staffId') staffId?: string) {
    return (await this.attendance.list(staffId)).map(serializeAttendanceRecord);
  }

  @Patch(':id')
  @CheckAbility('manage', 'Attendance')
  async update(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateAttendanceSchema)) dto: UpdateAttendance,
  ) {
    return serializeAttendanceRecord(await this.attendance.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(200)
  @CheckAbility('manage', 'Attendance')
  async remove(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    await this.attendance.remove(id);
    return { ok: true };
  }
}
