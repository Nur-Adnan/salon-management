import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerRepository } from './customer.repository.js';
import { Customer, CustomerSchema } from './customer.schema.js';
import { CustomersController } from './customers.controller.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }])],
  controllers: [CustomersController],
  providers: [CustomerRepository],
  exports: [CustomerRepository, MongooseModule],
})
export class CustomersModule {}
