import { BillingSettingsForm } from '../components/settings/BillingSettingsForm';
import { SettingsLayout, SettingsPageProps } from '../components/settings/SettingsLayout';
export function BillingSettingsPage(props: SettingsPageProps) {
  return <SettingsLayout {...props} area="billing"><BillingSettingsForm section="billing" onNotification={props.onNotification} /></SettingsLayout>;
}
