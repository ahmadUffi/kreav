import { Test } from '@nestjs/testing';
import { Controller, Get, HttpException, HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DomainException } from './domain.exception';
import { DomainExceptionFilter } from './domain-exception.filter';

/**
 * DomainExceptionFilter — test suite (BE-012, audit #12).
 *
 * Tests verify that the filter catches all exception types and returns
 * a consistent JSON shape: { code, message, statusCode, timestamp }.
 */

// Minimal test controllers to exercise the filter.
@Controller('test')
class TestController {
  @Get('domain-error')
  throwDomainError(): void {
    throw new DomainException('TEST_ERROR', 'A domain error occurred', 422);
  }

  @Get('http-error')
  throwHttpError(): void {
    throw new HttpException('Bad request', HttpStatus.BAD_REQUEST);
  }

  @Get('unknown-error')
  throwUnknownError(): void {
    throw new Error('Something went terribly wrong');
  }
}

describe('DomainExceptionFilter', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('DomainException → 422 with structured code', async () => {
    const res = await request(app.getHttpServer()).get('/test/domain-error');

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('TEST_ERROR');
    expect(res.body.message).toBe('A domain error occurred');
    expect(res.body.statusCode).toBe(422);
    expect(res.body.timestamp).toEqual(expect.any(String));
  });

  it('HttpException → 400 with REQUEST_ERROR code', async () => {
    const res = await request(app.getHttpServer()).get('/test/http-error');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REQUEST_ERROR');
    expect(res.body.message).toBe('Bad request');
  });

  it('Unknown Error → 500 with sanitized message', async () => {
    const res = await request(app.getHttpServer()).get('/test/unknown-error');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(res.body.message).toBe('An unexpected error occurred');
    expect(res.body.statusCode).toBe(500);
  });
});
