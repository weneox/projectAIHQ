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
  currentReview,
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
      currentReview={currentReview}
      reviewSources={reviewSources}
      reviewSyncState={reviewSyncState}
    />
  );
}
