import { BadRequestException } from '@nestjs/common';
import { decimalAmount, type DecimalAmount } from '@elhafez/contracts';

export function requiredText(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequestException(`${name} is required`);
  return value.trim();
}

export function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Canonical decimal parsing stays aligned with @elhafez/contracts (up to 18 fractional digits). */
export function requiredDecimal(value: unknown, name: string): DecimalAmount {
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequestException(`${name} is required`);
  try {
    return decimalAmount(value.trim());
  } catch {
    throw new BadRequestException(`${name} must be a valid decimal amount`);
  }
}
