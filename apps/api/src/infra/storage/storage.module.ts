import { Global, Module } from '@nestjs/common';
import { ObjectStorageService } from './object-storage.service.js';
import { StorageController } from './storage.controller.js';

@Global()
@Module({
  controllers: [StorageController],
  providers: [ObjectStorageService],
  exports: [ObjectStorageService],
})
export class StorageModule {}
