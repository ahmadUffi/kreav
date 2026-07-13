import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from './mailer.service';

/**
 * MailerService — focus on the dev escape-hatch and provider outcomes.
 * `fetch` is stubbed so no network call happens.
 */
describe('MailerService', () => {
  let service: MailerService;
  let configValues: Record<string, string | undefined>;

  const build = async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MailerService,
        { provide: ConfigService, useValue: { get: (k: string) => configValues[k] } },
      ],
    }).compile();
    return moduleRef.get(MailerService);
  };

  beforeEach(async () => {
    configValues = { RESEND_FROM: 'Kreav <test@kreav.dev>' };
    service = await build();
  });

  afterEach(() => jest.restoreAllMocks());

  it('SIMULATED (no send) when RESEND_API_KEY is absent', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as never);
    const result = await service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>' });

    expect(result.status).toBe('SIMULATED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SENT with provider id when the API accepts', async () => {
    configValues.RESEND_API_KEY = 're_test_key';
    service = await build();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_123' }),
    } as never);

    const result = await service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>' });

    expect(result.status).toBe('SENT');
    expect(result.providerMessageId).toBe('msg_123');
  });

  it('FAILED when the API rejects', async () => {
    configValues.RESEND_API_KEY = 're_test_key';
    service = await build();
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'invalid from',
    } as never);

    const result = await service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>' });

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('422');
  });
});
