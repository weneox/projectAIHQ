import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import BrandProfileForm from "../../../components/settings/BrandProfileForm.jsx";

export default function BrandSection({ profile, patchProfile, canManage, surface }) {
  return (
    <div className="space-y-4">
      <SettingsSurfaceBanner
        surface={surface}
        unavailableMessage="Brand settings are temporarily unavailable."
      />
      <BrandProfileForm
        profile={profile}
        patchProfile={patchProfile}
        canManage={canManage}
      />
    </div>
  );
}
