import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/components/authentication/recovery-forms';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
