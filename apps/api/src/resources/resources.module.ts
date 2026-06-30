import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResourceRepository } from './resource.repository';
import { Resource, ResourceSchema } from './resource.schema';
import { ResourcesController } from './resources.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Resource.name, schema: ResourceSchema }])],
  controllers: [ResourcesController],
  providers: [ResourceRepository],
})
export class ResourcesModule {}
