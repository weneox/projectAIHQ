import ReviewWorkspace from "./review/ReviewWorkspace.jsx";

export default function SetupStudioRefineModal({
  savingBusiness,
  businessForm,
  discoveryProfileRows,
  manualSections,
  onSetBusinessField,
  onSetManualSection,
  onSaveBusiness,
  onClose,
  reviewDraft,
  reviewSources = [],
  reviewSyncState = {},
}) {
  return (
    <ReviewWorkspace
      savingBusiness={savingBusiness}
      businessForm={businessForm}
      discoveryProfileRows={discoveryProfileRows}
      manualSections={manualSections}
      onSetBusinessField={onSetBusinessField}
      onSetManualSection={onSetManualSection}
      onSaveBusiness={onSaveBusiness}
      onClose={onClose}
      reviewDraft={reviewDraft}
      reviewSources={reviewSources}
      reviewSyncState={reviewSyncState}
    />
  );
}
