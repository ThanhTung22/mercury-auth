import { HashingModule } from '@mercury-labs/hashing'
import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  ModuleMetadata,
  NestModule,
  RequestMethod,
  Type,
} from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import {
  AUTH_DEFINITIONS_MODULE_OPTIONS,
  AuthDefinitionsModule,
  IAuthDefinitions,
  IAuthDefinitionsModuleOptions,
} from './auth-definitions.module'
import {
  AUTH_PASSWORD_HASHER,
  AuthBasicGuard,
  AuthenticationService,
  AuthGlobalGuard,
  AuthRefreshTokenGuard,
  AuthRepository,
  BcryptPasswordHasherService,
  JwtStrategy,
  LocalStrategy,
  LoginAction,
  PasswordHasherService,
  RefreshTokenStrategy,
} from './domain'
import { BasicAuthMiddleware, LocalAuthRepository } from './infrastructure'
import {
  ClearAuthCookieInterceptor,
  CookieAuthInterceptor,
  LoginController,
  ProfileController,
  RefreshTokenController,
} from './presentation'
import { LogoutController } from './presentation/controllers/logout.controller'

export interface IAuthModuleOptions extends Pick<ModuleMetadata, 'imports'> {
  definitions: IAuthDefinitionsModuleOptions
  authRepository: {
    useFactory: (...args: any[]) => Promise<AuthRepository> | AuthRepository
    inject?: Type[]
  }
  passwordHasher?: {
    useFactory: (
      ...args: any[]
    ) => Promise<PasswordHasherService> | PasswordHasherService
    inject?: Type[]
  }
}

@Module({})
export class AuthModule implements NestModule {
  public static forRootAsync(options: IAuthModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      providers: [
        {
          provide: AUTH_PASSWORD_HASHER,
          useFactory:
            options.passwordHasher?.useFactory ||
            (() => new BcryptPasswordHasherService()),
          inject: options.passwordHasher?.inject,
        },

        {
          provide: AuthRepository,
          useFactory:
            options.authRepository.useFactory ||
            ((hasher: PasswordHasherService) =>
              new LocalAuthRepository(hasher)),
          inject: options.authRepository.inject || [AUTH_PASSWORD_HASHER],
        },

        {
          provide: APP_GUARD,
          useClass: AuthGlobalGuard,
        },

        AuthenticationService,

        LocalStrategy,
        JwtStrategy,
        RefreshTokenStrategy,

        LoginAction,

        AuthBasicGuard,
        AuthRefreshTokenGuard,

        ClearAuthCookieInterceptor,
        CookieAuthInterceptor,
      ],
      imports: [
        ...(options.imports || []),
        HashingModule,
        AuthDefinitionsModule.forRootAsync(options.definitions),
        JwtModule.registerAsync({
          useFactory: (definitions: IAuthDefinitions) => {
            return {
              secret: definitions.jwt.secret,
              signOptions: {
                expiresIn: definitions.jwt.expiresIn,
              },
            }
          },
          inject: [AUTH_DEFINITIONS_MODULE_OPTIONS],
          imports: [AuthDefinitionsModule],
        }),
      ],
      controllers: [
        LoginController,
        RefreshTokenController,
        LogoutController,
        ProfileController,
      ],
      exports: [
        AuthRepository,

        AUTH_PASSWORD_HASHER,

        ClearAuthCookieInterceptor,
        CookieAuthInterceptor,

        LocalStrategy,
        JwtStrategy,
        RefreshTokenStrategy,
      ],
    }
  }

  public configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(BasicAuthMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL })
  }
}
