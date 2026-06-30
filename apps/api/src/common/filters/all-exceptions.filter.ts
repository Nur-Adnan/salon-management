import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { Request, Response } from 'express';

// Maps every thrown error to RFC 7807 problem+json. 5xx details are never leaked.
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('Exceptions');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const title = isHttp ? exception.name : 'Internal Server Error';

    let detail: unknown;
    if (status < 500 && isHttp) {
      const body = exception.getResponse();
      detail = typeof body === 'string' ? body : (body as { message?: unknown }).message;
    }

    if (status >= 500) {
      this.logger.error({ err: exception, path: req.url }, 'Unhandled exception');
    }

    res
      .status(status)
      .type('application/problem+json')
      .send({
        type: 'about:blank',
        title,
        status,
        detail,
        instance: req.url,
        correlationId: (req as Request & { id?: string }).id,
      });
  }
}
