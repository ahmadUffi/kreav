import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WebAuth } from '@stellar/stellar-sdk';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformKeypairService } from '../stellar/platform-keypair.service';
import { STELLAR_PUBLIC_CONFIG, type StellarPublicConfig } from '../stellar/stellar.config';
import type { AppConfig } from '../config/configuration';
import {
  RegisterDto,
  RegisterResponseDto,
  RegisterWithTokenResponseDto,
  ChallengeResponseDto,
  AuthTokenResponseDto,
} from './dto';

/** Challenge validity window (seconds). */
const CHALLENGE_TIMEOUT_S = 300;

function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex < 0) return email;
  const visible = Math.min(3, atIndex);
  return email.slice(0, visible) + '***' + email.slice(atIndex);
}

/**
 * AuthService — BE-021 registration + Fase 1 SEP-10 wallet auth.
 *
 * Session model:
 * - POST /auth/register  → creates the user and issues a session JWT
 *   (register = logged in — standard web behaviour).
 * - POST /auth/challenge → SEP-10 challenge tx for a wallet address
 *   (returning-creator login; sign with Freighter).
 * - POST /auth/verify    → verifies the signed challenge, resolves the wallet
 *   to its Kreav account, issues a session JWT.
 *
 * JWT payload: { sub: userId, role, email }. Identity on protected routes
 * comes from this token via JwtAuthGuard — never from query params.
 *
 * Non-custodial: the challenge is signed client-side by the creator's wallet;
 * the server never sees a secret key (the platform key only co-signs the
 * challenge, per SEP-10).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** In-memory nonce store — prevents SEP-10 challenge replay within the validity window. */
  private readonly usedChallenges = new Map<string, NodeJS.Timeout>();

  /** In-memory revoked JWT set — tokens invalidated via /auth/logout. */
  private readonly revokedTokens = new Set<string>();

  private readonly homeDomain: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly platformKey: PlatformKeypairService,
    @Inject(STELLAR_PUBLIC_CONFIG) private readonly stellar: StellarPublicConfig,
    private readonly config: ConfigService<AppConfig>,
  ) {
    this.homeDomain = this.config.get('SEP10_HOME_DOMAIN', 'kreav.space')!;
    if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
      this.logger.warn(
        'JWT_SECRET not set — using an auto-generated per-process secret. ' +
          'Tokens are valid only within this process lifetime. Set a real JWT_SECRET before any deployment.',
      );
    }
  }

  /**
   * Register a new user and issue a session token.
   * Throws 409 Conflict if the email is already registered.
   */
  async register(dto: RegisterDto): Promise<RegisterWithTokenResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      this.logger.warn(`Registration failed — email already in use: ${maskEmail(dto.email)}`);
      throw new ConflictException(`Email ${dto.email} is already registered`);
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    this.logger.log(`User registered: ${user.id} (${maskEmail(user.email)}, ${user.role})`);

    return {
      ...this.toProfile(user),
      token: this.signToken(user.id, user.role, user.email),
    };
  }

  /**
   * Report whether a wallet is already linked to a Kreav account.
   *
   * Pre-auth, read-only. The navbar uses this to branch: a registered wallet
   * goes through SEP-10 login; an unknown wallet is sent to creator onboarding
   * (so a brand-new user never signs a challenge that would only fail).
   */
  async walletStatus(walletAddress: string): Promise<{ registered: boolean }> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { walletAddress },
      select: { id: true },
    });
    return { registered: !!wallet };
  }

  /**
   * Build a SEP-10 challenge transaction for a wallet address.
   * The client signs it with Freighter and POSTs it back to /auth/verify.
   */
  buildChallenge(walletAddress: string): ChallengeResponseDto {
    const serverKeypair = this.platformKey.getKeypair();
    const transaction = WebAuth.buildChallengeTx(
      serverKeypair,
      walletAddress,
      this.homeDomain,
      CHALLENGE_TIMEOUT_S,
      this.stellar.networkPassphrase,
      this.homeDomain,
    );
    this.logger.log(`SEP-10 challenge issued for ${walletAddress.slice(0, 8)}...`);
    return { transaction, networkPassphrase: this.stellar.networkPassphrase };
  }

  /**
   * Verify a signed SEP-10 challenge and issue a session token.
   *
   * - Validates the server signature + timebounds (readChallengeTx).
   * - Requires the client wallet's signature (verifyChallengeTxSigners).
   * - Resolves the wallet to its Kreav account via the Wallet table.
   *
   * Throws 401 on any verification failure or unknown wallet.
   */
  async verifyChallenge(signedXdr: string): Promise<AuthTokenResponseDto> {
    // Nonce check: reject replayed challenges within the validity window.
    const nonce = createHash('sha256').update(signedXdr).digest('hex');
    if (this.usedChallenges.has(nonce)) {
      this.logger.warn(`SEP-10 challenge replay rejected (nonce=${nonce.slice(0, 8)}...)`);
      throw new UnauthorizedException('Challenge already used');
    }
    this.usedChallenges.set(
      nonce,
      setTimeout(() => this.usedChallenges.delete(nonce), CHALLENGE_TIMEOUT_S * 1000),
    );

    const serverPublicKey = this.platformKey.getPublicKey();

    let clientAccountID: string;
    try {
      const challenge = WebAuth.readChallengeTx(
        signedXdr,
        serverPublicKey,
        this.stellar.networkPassphrase,
        this.homeDomain,
        this.homeDomain,
      );
      clientAccountID = challenge.clientAccountID;

      // Must be signed by the client wallet (server sig already checked above).
      WebAuth.verifyChallengeTxSigners(
        signedXdr,
        serverPublicKey,
        this.stellar.networkPassphrase,
        [clientAccountID],
        this.homeDomain,
        this.homeDomain,
      );
    } catch (err) {
      this.logger.warn(
        `SEP-10 verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException('Challenge verification failed');
    }

    // Resolve the wallet to a Kreav account.
    const wallet = await this.prisma.wallet.findFirst({
      where: { walletAddress: clientAccountID },
      select: {
        creator: {
          select: { id: true, email: true, name: true, role: true, createdAt: true },
        },
      },
    });
    if (!wallet) {
      this.logger.warn(
        `SEP-10 verified but wallet not connected: ${clientAccountID.slice(0, 8)}...`,
      );
      throw new UnauthorizedException('Wallet is not connected to any Kreav account');
    }

    const user = wallet.creator;
    this.logger.log(`SEP-10 login: ${user.id} via ${clientAccountID.slice(0, 8)}...`);

    return {
      token: this.signToken(user.id, user.role, user.email),
      user: this.toProfile(user),
    };
  }

  /** Sign a session JWT. Payload: { sub, role, email, jti }. */
  private signToken(userId: string, role: string, email: string): string {
    return this.jwt.sign({ sub: userId, role, email, jti: randomUUID() });
  }

  /** Revoke a token by its JWT ID (jti). */
  revokeToken(jti: string): void {
    this.revokedTokens.add(jti);
    this.logger.log(`Token revoked: jti=${jti.slice(0, 8)}...`);
  }

  /** Check whether a token has been revoked. */
  isTokenRevoked(jti: string): boolean {
    return this.revokedTokens.has(jti);
  }

  private toProfile(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: Date | string;
  }): RegisterResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt:
        user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
    };
  }
}
