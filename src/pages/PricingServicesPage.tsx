import { BillingSettingsForm } from '../components/settings/BillingSettingsForm';
import { CatalogueSection } from '../components/settings/CatalogueSection';
import { SettingsLayout, SettingsPageProps } from '../components/settings/SettingsLayout';
export function PricingServicesPage(props: SettingsPageProps) {
  return <SettingsLayout {...props} area="services">
    <CatalogueSection section="services" onNotification={props.onNotification} />
    <CatalogueSection section="vehicles" onNotification={props.onNotification} />
    <BillingSettingsForm section="dispatch" onNotification={props.onNotification} />
  </SettingsLayout>;
}
