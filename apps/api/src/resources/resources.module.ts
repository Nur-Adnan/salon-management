import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResourceRepository } from './resource.repository.js';
import { Resource, ResourceSchema } from './resource.schema.js';
import { ResourcesController } from './resources.controller.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Resource.name, schema: ResourceSchema }])],
  controllers: [ResourcesController],
  providers: [ResourceRepository],
})
export class ResourcesModule {}
