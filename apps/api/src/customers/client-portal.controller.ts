import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../iam/auth/public.decorator.js';
import { ClientAuthGuard, type ClientJwtPayload } from './client-auth.guard.js';
import { ClientPortalService } from './client-portal.service.js';

@Controller('public/:slug/portal')
export class ClientPortalController {
  constructor(private readonly portal: ClientPortalService) {}

  @Public()
  @Post('auth/request-otp')
  async requestOtp(
    @Param('slug') slug: string,
    @Body('phone') phone: string,
  ) {
    return this.portal.requestOtp(slug, phone);
  }

  @Public()
  @Post('auth/verify-otp')
  async verifyOtp(
    @Param('slug') slug: string,
    @Body('phone') phone: string,
    @Body('code') code: string,
  ) {
    return this.portal.verifyOtp(slug, phone, code);
  }

  // --- Client Authenticated Endpoints ---

  @Public()
  @UseGuards(ClientAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: { client: ClientJwtPayload }) {
    return this.portal.getProfile(req.client.tenantId, req.client.customerId);
  }

  @Public()
  @UseGuards(ClientAuthGuard)
  @Patch('profile')
  async updateProfile(
    @Req() req: { client: ClientJwtPayload },
    @Body() body: { name?: string; email?: string; marketingOptOut?: boolean },
  ) {
    return this.portal.updateProfile(req.client.tenantId, req.client.customerId, body);
  }

  @Public()
  @UseGuards(ClientAuthGuard)
  @Get('appointments')
  async getAppointments(@Req() req: { client: ClientJwtPayload }) {
    return this.portal.getAppointments(req.client.tenantId, req.client.customerId);
  }

  @Public()
  @UseGuards(ClientAuthGuard)
  @Post('appointments/:id/cancel')
  async cancelAppointment(
    @Req() req: { client: ClientJwtPayload },
    @Param('id') appointmentId: string,
  ) {
    return this.portal.cancelAppointment(req.client.tenantId, req.client.customerId, appointmentId);
  }

  @Public()
  @UseGuards(ClientAuthGuard)
  @Get('loyalty')
  async getLoyalty(@Req() req: { client: ClientJwtPayload }) {
    return this.portal.getLoyalty(req.client.tenantId, req.client.customerId);
  }

  @Public()
  @UseGuards(ClientAuthGuard)
  @Get('subscriptions')
  async getSubscriptions(@Req() req: { client: ClientJwtPayload }) {
    return this.portal.getSubscriptions(req.client.tenantId, req.client.customerId);
  }

  @Public()
  @UseGuards(ClientAuthGuard)
  @Get('gift-cards')
  async getGiftCards(@Req() req: { client: ClientJwtPayload }) {
    return this.portal.getGiftCards(req.client.tenantId, req.client.customerId);
  }
}
