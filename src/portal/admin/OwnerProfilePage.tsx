import type { Account } from '../api';
import { Card, Field } from '../ui';
import { PasswordPage } from '../PasswordPage';

export function OwnerProfilePage({ account }: { account: Account }) {
  return <div className="space-y-8">
    <Card title="Owner account" description="The platform owner is provisioned privately with the server bootstrap command and cannot sign in to company workspaces.">
      <div className="grid max-w-xl gap-5 sm:grid-cols-2"><Field label="Login ID" readOnly value={account.login_id} /><Field label="Role" readOnly value="Platform owner" /></div>
    </Card>
    <PasswordPage />
  </div>;
}
