import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/components/authentication/recovery-forms';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
