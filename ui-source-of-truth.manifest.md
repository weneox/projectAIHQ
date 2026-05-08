# UI Source of Truth Manifest

## Current source of truth

- Login UI: `ai-hq-frontend/src/pages/Login.jsx`
- Team UI: `ai-hq-frontend/src/pages/Team.jsx`
- Temporary Inbox UI: `ai-hq-frontend/src/pages/Inbox.jsx` and `components/inbox/*`
- Shared primitives: `components/ui/*`

## Rebuild pages

- ai-hq-frontend/src/pages/AdminLogin.jsx
- ai-hq-frontend/src/pages/AdminSecrets.jsx
- ai-hq-frontend/src/pages/AdminTeam.jsx
- ai-hq-frontend/src/pages/AdminTenants.jsx
- ai-hq-frontend/src/pages/ChannelCatalog.jsx
- ai-hq-frontend/src/pages/Comments.jsx
- ai-hq-frontend/src/pages/Customers.jsx
- ai-hq-frontend/src/pages/Executions.jsx
- ai-hq-frontend/src/pages/Incidents.jsx
- ai-hq-frontend/src/pages/Knowledge.jsx
- ai-hq-frontend/src/pages/LaunchChecklist.jsx
- ai-hq-frontend/src/pages/Leads.jsx
- ai-hq-frontend/src/pages/Proposals.jsx
- ai-hq-frontend/src/pages/PublicWebsiteWidget.jsx
- ai-hq-frontend/src/pages/Publish.jsx
- ai-hq-frontend/src/pages/Reports.jsx
- ai-hq-frontend/src/pages/SelectWorkspace.jsx
- ai-hq-frontend/src/pages/Settings.jsx
- ai-hq-frontend/src/pages/Truth/TruthViewerPage.jsx
- ai-hq-frontend/src/pages/VerifyEmail.jsx
- ai-hq-frontend/src/pages/Voice.jsx
- ai-hq-frontend/src/pages/Welcome.jsx

## Rebuild components

- ai-hq-frontend/src/components/admin/AdminPageShell.jsx
- ai-hq-frontend/src/components/admin/AdminShell.jsx
- ai-hq-frontend/src/components/admin/ProviderSecretsPanel.jsx
- ai-hq-frontend/src/components/auth/EmailVerificationBanner.jsx
- ai-hq-frontend/src/components/auth/OperatorRouteGuard.jsx
- ai-hq-frontend/src/components/channels/ChannelDetailDrawer.jsx
- ai-hq-frontend/src/components/channels/ChannelIcon.jsx
- ai-hq-frontend/src/components/channels/ChannelOverviewCard.jsx
- ai-hq-frontend/src/components/channels/ChannelPrimitives.jsx
- ai-hq-frontend/src/components/channels/WebsiteWidgetDetailDrawer.jsx
- ai-hq-frontend/src/components/comments/CommentMiniInfo.jsx
- ai-hq-frontend/src/components/comments/CommentRow.jsx
- ai-hq-frontend/src/components/comments/CommentStatCard.jsx
- ai-hq-frontend/src/components/customers/CustomerMetricCards.jsx
- ai-hq-frontend/src/components/executions/execution-ui.jsx
- ai-hq-frontend/src/components/feedback/SurfaceBanner.jsx
- ai-hq-frontend/src/components/governance/GovernanceCockpit.jsx
- ai-hq-frontend/src/components/governance/GovernanceHistoryPanel.jsx
- ai-hq-frontend/src/components/governance/TruthReviewWorkbench.jsx
- ai-hq-frontend/src/components/layout/CommandMenu.jsx
- ai-hq-frontend/src/components/layout/FloatingAiWidget.jsx
- ai-hq-frontend/src/components/layout/Header.jsx
- ai-hq-frontend/src/components/layout/NotificationsPanel.jsx
- ai-hq-frontend/src/components/layout/SetupAssistantSections.jsx
- ai-hq-frontend/src/components/layout/SetupReviewActivationPanel.jsx
- ai-hq-frontend/src/components/layout/Shell.jsx
- ai-hq-frontend/src/components/layout/Sidebar.jsx
- ai-hq-frontend/src/components/leads/LeadFormControls.jsx
- ai-hq-frontend/src/components/leads/LeadMiniInfo.jsx
- ai-hq-frontend/src/components/leads/LeadRow.jsx
- ai-hq-frontend/src/components/leads/LeadStatCard.jsx
- ai-hq-frontend/src/components/loading/AppBootSurface.jsx
- ai-hq-frontend/src/components/ProposalCanvas.jsx
- ai-hq-frontend/src/components/proposals/proposal-ui.jsx
- ai-hq-frontend/src/components/proposals/ProposalCard.jsx
- ai-hq-frontend/src/components/proposals/ProposalExpanded.jsx
- ai-hq-frontend/src/components/proposals/ProposalSections.jsx
- ai-hq-frontend/src/components/readiness/RepairHub.jsx
- ai-hq-frontend/src/components/truth/TruthBehaviorCard.jsx
- ai-hq-frontend/src/components/truth/TruthFieldTable.jsx
- ai-hq-frontend/src/components/truth/TruthHeader.jsx
- ai-hq-frontend/src/components/truth/TruthHistoryPanel.jsx
- ai-hq-frontend/src/components/truth/TruthProvenancePanel.jsx
- ai-hq-frontend/src/components/truth/TruthVersionComparePanel.jsx

## Rule

Other page/component UI is legacy and will be rebuilt from Login/Team language.
Backend/data/API/state logic stays.
