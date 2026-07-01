import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, RegisterResponseDto } from './dto';

/**
 * AuthService — BE-021 registration logic.
 *
 * Email-only registration. No password hashing, no JWT, no session.
 * Identity is by Stellar wallet (non-custodial philosophy).
 *
 * Source: BE-021 — User Registration API.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a new user.
   *
   * Validates email uniqueness before creating. Returns the created user profile.
   * Throws 409 Conflict if the email is already registered.
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    // Check for duplicate email.
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      this.logger.warn(`Registration failed — email already in use: ${dto.email}`);
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

    this.logger.log(`User registered: ${user.id} (${user.email}, ${user.role})`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : String(user.createdAt),
    };
  }
}
