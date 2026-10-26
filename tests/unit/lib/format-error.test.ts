/**
 * Every form used to crash on invalid input: formatError read Zod 3's
 * `error.errors`, which Zod 4 removed.
 */
import { describe, expect, it } from 'vitest';
import { formatError } from '@/lib/utils';
import { signUpFormSchema } from '@/lib/validator';

describe('validation errors become messages instead of crashing', () => {
  it('formats a real Zod 4 error', () => {
    const result = signUpFormSchema.safeParse({
      name: 'Esham',
      email: 'esham@example.com',
      password: 'secret-one',
      confirmPassword: 'secret-two',
    });

    expect(result.success).toBe(false);
    expect(formatError(result.error)).toBe("Passwords don't match");
  });

  it('joins several issues', () => {
    const result = signUpFormSchema.safeParse({
      name: 'Al',
      email: 'not-an-email',
      password: '12345678',
      confirmPassword: '12345678',
    });

    const message = formatError(result.error);
    expect(message).toContain('Name must be at least 3 characters');
    expect(message).toContain('Invalid email address');
  });
});
