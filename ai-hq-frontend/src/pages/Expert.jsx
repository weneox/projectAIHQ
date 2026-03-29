import SettingsController from "./Settings/SettingsController.jsx";

export default function Expert() {
  return (
    <SettingsController
      shellEyebrow="Advanced Controls"
      shellTitle="Expert"
      shellSubtitle="Detailed governance, source controls, policy posture, runtime inspection, and audit history in one advanced workspace."
      navTitle="Advanced Sections"
      navSubtitle="Detailed controls"
      showSectionContractCopy={false}
    />
  );
}
