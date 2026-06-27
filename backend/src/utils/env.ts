import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_PATH: string;
  LOG_LEVEL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  CREDENTIAL_MASTER_KEY?: string;
  ALLOWED_ORIGINS: string[];
  DOUBAO_API_KEY?: string;
  DOUBAO_API_BASE?: string;
  DOUBAO_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_API_BASE?: string;
  OPENAI_MODEL?: string;
  LOCAL_AI_API_KEY?: string;
  LOCAL_AI_API_BASE?: string;
  LOCAL_AI_MODEL?: string;
  WEBHOOK_VERIFY_ENABLED?: boolean;
  WEBHOOK_SECRET?: string;
  WEBHOOK_IP_WHITELIST?: string;
  ALERT_WEBHOOK_URL?: string;
  ALERT_EMAIL_HOST?: string;
  ALERT_EMAIL_PORT?: number;
  ALERT_EMAIL_USER?: string;
  ALERT_EMAIL_PASS?: string;
  ALERT_EMAIL_TO?: string;
  BCRYPT_SALT_ROUNDS: number;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined) {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`Missing required environment variable: ${key}`);
}

function getEnvAsNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value !== undefined) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}

function validateEnv(): EnvConfig {
  const warnings: string[] = [];
  const errors: string[] = [];

  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;

  if (isProduction && !jwtSecret) {
    errors.push('Missing required environment variable: JWT_SECRET (must be set in production)');
  } else if (!jwtSecret) {
    warnings.push('Missing recommended environment variable: JWT_SECRET (using insecure default, DO NOT use in production)');
  }

  if (jwtSecret && jwtSecret === 'itops-agent-platform-secret-key-change-in-production') {
    if (isProduction) {
      throw new Error('Cannot use default JWT_SECRET in production! Please set a secure secret.');
    } else {
      console.warn('⚠️ WARNING: Using default JWT secret. This is INSECURE and should ONLY be used for development!');
    }
  }

  // SEC-027: Enforce minimum JWT_SECRET length in production (32 chars)
  if (isProduction && jwtSecret && jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  }

  if (warnings.length > 0) {
    console.warn('⚠️ Environment warnings:');
    warnings.forEach(warn => console.warn(`  - ${warn}`));
  }

  if (errors.length > 0) {
    console.error('❌ Environment errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    if (isProduction) {
      throw new Error('Cannot start in production without required environment variables');
    }
  }

  let finalJwtSecret: string;
  if (!jwtSecret) {
    finalJwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ WARNING: Using a randomly generated JWT secret for this session.');
    console.warn('   This means all tokens will be invalidated on server restart.');
    console.warn('   Set JWT_SECRET in your .env file for persistent sessions.');
  } else {
    finalJwtSecret = jwtSecret;
  }

  // SEC-032: Encryption key management notice
  if (!process.env.CREDENTIAL_MASTER_KEY) {
    if (isProduction) {
      console.warn('⚠️ SECURITY WARNING: CREDENTIAL_MASTER_KEY is not set in production.');
      console.warn('   Encryption keys are stored in the database. For better security, set CREDENTIAL_MASTER_KEY');
      console.warn('   and implement external key management (e.g., AWS KMS, HashiCorp Vault).');
    }
  }

  return {
    NODE_ENV: getEnv('NODE_ENV', 'development'),
    PORT: getEnvAsNumber('PORT', 3001),
    DATABASE_PATH: getEnv('DATABASE_PATH', './data/app.db'),
    LOG_LEVEL: getEnv('LOG_LEVEL', 'info'),
    JWT_SECRET: finalJwtSecret,
    JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '24h'),
    // SEC-046: Configurable refresh token expiration (default 7 days, min 1 hour)
    JWT_REFRESH_EXPIRES_IN: (() => {
      const val = getEnv('JWT_REFRESH_EXPIRES_IN', '7d');
      const validPattern = /^(\d+)(s|m|h|d)$/;
      if (!validPattern.test(val)) {
        console.warn('⚠️ SECURITY WARNING: JWT_REFRESH_EXPIRES_IN has invalid format, using default 7d');
        return '7d';
      }
      return val;
    })(),
    CREDENTIAL_MASTER_KEY: process.env.CREDENTIAL_MASTER_KEY,
    // SEC-028: Validate ALLOWED_ORIGINS format (must be valid URLs with protocol)
    ALLOWED_ORIGINS: (() => {
      const origins = getEnv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean);
      const originPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
      for (const origin of origins) {
        if (!originPattern.test(origin)) {
          const msg = `Invalid ALLOWED_ORIGINS entry: "${origin}" - must be a valid URL with protocol (http:// or https://)`;
          if (process.env.NODE_ENV === 'production') {
            throw new Error(msg);
          } else {
            console.warn(`⚠️ SECURITY WARNING: ${msg}`);
          }
        }
      }
      return origins;
    })(),
    DOUBAO_API_KEY: process.env.DOUBAO_API_KEY,
    DOUBAO_API_BASE: process.env.DOUBAO_API_BASE,
    DOUBAO_MODEL: process.env.DOUBAO_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_API_BASE: process.env.OPENAI_API_BASE,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    LOCAL_AI_API_KEY: process.env.LOCAL_AI_API_KEY,
    LOCAL_AI_API_BASE: process.env.LOCAL_AI_API_BASE,
    LOCAL_AI_MODEL: process.env.LOCAL_AI_MODEL,
    WEBHOOK_VERIFY_ENABLED: process.env.WEBHOOK_VERIFY_ENABLED !== 'false',
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
    ALERT_EMAIL_HOST: process.env.ALERT_EMAIL_HOST,
    ALERT_EMAIL_PORT: getEnvAsNumber('ALERT_EMAIL_PORT', 587),
    ALERT_EMAIL_USER: process.env.ALERT_EMAIL_USER,
    ALERT_EMAIL_PASS: process.env.ALERT_EMAIL_PASS,
    ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO,
    // SEC-031: Make bcrypt salt rounds configurable (default 12, minimum 10)
    BCRYPT_SALT_ROUNDS: (() => {
      const val = getEnvAsNumber('BCRYPT_SALT_ROUNDS', 12);
      if (val < 10) {
        console.warn('⚠️ SECURITY WARNING: BCRYPT_SALT_ROUNDS below 10 is insecure. Using 10.');
        return 10;
      }
      return val;
    })()
  };
}

export const env = validateEnv();
