import { BillingSettingsForm } from '../components/settings/BillingSettingsForm';
import { SettingsLayout, SettingsPageProps } from '../components/settings/SettingsLayout';
export function CompanySettingsPage(props: SettingsPageProps) {
  return <SettingsLayout {...props} area="company"><BillingSettingsForm section="company" onNotification={props.onNotification} /></SettingsLayout>;
}
