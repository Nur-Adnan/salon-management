import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  type AddTreatmentPhoto,
  type CreateTreatmentRecord,
  type TreatmentPhotoConsentAction,
  addTreatmentPhotoSchema,
  createTreatmentRecordSchema,
  objectIdSchema,
  treatmentPhotoConsentActionSchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializeTreatmentRecord } from './mappers.js';
import { TreatmentRecordsService } from './treatment-records.service.js';

@Controller('treatment-records')
export class TreatmentRecordsController {
  constructor(private readonly records: TreatmentRecordsService) {}

  @Get('by-customer/:customerId')
  @CheckAbility('read', 'Treatment')
  async forCustomer(@Param('customerId', new ZodValidationPipe(objectIdSchema)) customerId: string) {
    return (await this.records.forCustomer(customerId)).map(serializeTreatmentRecord);
  }

  @Get(':id')
  @CheckAbility('read', 'Treatment')
  async get(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    return serializeTreatmentRecord(await this.records.get(id));
  }

  @Post()
  @CheckAbility('create', 'Treatment')
  async create(@Body(new ZodValidationPipe(createTreatmentRecordSchema)) dto: CreateTreatmentRecord) {
    return serializeTreatmentRecord(await this.records.create(dto));
  }

  @Post(':id/photos')
  @CheckAbility('update', 'Treatment')
  async addPhoto(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(addTreatmentPhotoSchema)) dto: AddTreatmentPhoto,
  ) {
    return serializeTreatmentRecord(await this.records.addPhoto(id, dto));
  }

  // The only endpoint that may change a photo's consent state. Mutates
  // existing state (not a creation), so 200 rather than the POST default 201.
  @Post(':id/photos/:photoId/consent')
  @HttpCode(200)
  @CheckAbility('update', 'Treatment')
  async setConsent(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Param('photoId') photoId: string,
    @Body(new ZodValidationPipe(treatmentPhotoConsentActionSchema)) dto: TreatmentPhotoConsentAction,
  ) {
    return serializeTreatmentRecord(await this.records.setPhotoConsent(id, photoId, dto));
  }

  @Delete(':id/photos/:photoId')
  @CheckAbility('update', 'Treatment')
  async removePhoto(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Param('photoId') photoId: string,
  ) {
    return serializeTreatmentRecord(await this.records.removePhoto(id, photoId));
  }
}
