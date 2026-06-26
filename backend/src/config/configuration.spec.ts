import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import configuration, { validationSchema } from './configuration';

describe('configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Start each test from a clean env so validation is deterministic.
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('configuration() factory', () => {
    it('reads NODE_ENV / PORT / DATABASE_URL from the environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '4000';
      process.env.DATABASE_URL = 'postgresql://u:p@host:5432/db';

      const config = configuration();

      expect(config.NODE_ENV).toBe('production');
      expect(config.PORT).toBe(4000);
      expect(config.DATABASE_URL).toBe('postgresql://u:p@host:5432/db');
    });

    it('defaults PORT to 3000 when unset', () => {
      delete process.env.PORT;
      expect(configuration().PORT).toBe(3000);
    });
  });

  describe('validationSchema', () => {
    it('accepts a valid configuration', () => {
      const { error } = validationSchema.validate({
        NODE_ENV: 'development',
        PORT: 3000,
        DATABASE_URL: 'postgresql://localhost/kreav',
      });
      expect(error).toBeUndefined();
    });

    it('rejects an invalid NODE_ENV', () => {
      const { error } = validationSchema.validate({
        NODE_ENV: 'staging', // not in the allow-list
        PORT: 3000,
        DATABASE_URL: 'postgresql://localhost/kreav',
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain('NODE_ENV');
    });

    it('rejects a non-numeric / out-of-range PORT', () => {
      const { error } = validationSchema.validate({
        NODE_ENV: 'development',
        PORT: 99999,
        DATABASE_URL: 'postgresql://localhost/kreav',
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain('PORT');
    });

    it('rejects an empty DATABASE_URL (DB is required since BE-002)', () => {
      const { error } = validationSchema.validate({
        NODE_ENV: 'development',
        PORT: 3000,
        DATABASE_URL: '',
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain('DATABASE_URL');
    });

    it('rejects a non-postgresql DATABASE_URL', () => {
      const { error } = validationSchema.validate({
        NODE_ENV: 'development',
        PORT: 3000,
        DATABASE_URL: 'mysql://localhost/kreav',
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain('DATABASE_URL');
    });

    it('accepts an optional GCASH_WEBHOOK_SECRET (audit #11)', () => {
      const withSecret = validationSchema.validate({
        NODE_ENV: 'development',
        PORT: 3000,
        DATABASE_URL: 'postgresql://localhost/kreav',
        GCASH_WEBHOOK_SECRET: 'a-real-secret',
      });
      expect(withSecret.error).toBeUndefined();

      const withoutSecret = validationSchema.validate({
        NODE_ENV: 'development',
        PORT: 3000,
        DATABASE_URL: 'postgresql://localhost/kreav',
      });
      expect(withoutSecret.error).toBeUndefined();
    });
  });

  describe('ConfigModule integration (fail-fast)', () => {
    it('boots when env is valid', async () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://localhost/kreav';

      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            validationSchema,
            validationOptions: { abortEarly: false },
          }),
        ],
      }).compile();

      const configService = moduleRef.get(ConfigModule);
      expect(configService).toBeDefined();
      await moduleRef.close();
    });
  });
});
