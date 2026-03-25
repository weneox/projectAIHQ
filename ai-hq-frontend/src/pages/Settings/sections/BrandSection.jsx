import BrandProfileForm from "../../../components/settings/BrandProfileForm.jsx";

export default function BrandSection({ profile, patchProfile, canManage }) {
  return (
    <BrandProfileForm
      profile={profile}
      patchProfile={patchProfile}
      canManage={canManage}
    />
  );
}
