# Changelog

## 3.4.1
- Fixed abnormal vital alerts to use the complete Critical Alert message template.
- Clinical WhatsApp alerts now include patient name, observation, severity, time, room/bed and recorded-by staff.
- Existing editable Communication Centre template is respected.
- No Supabase SQL changes required.

# Changelog

## 3.4.0
- Added Communication Centre.
- Added editable professional message templates.
- Added notification rules for WhatsApp and in-app delivery.
- Added quick message cards for billing, appointments, clinical alerts, admission and discharge.
- Added template variables and automatic patient-data replacement.
- Added one-click WhatsApp composer and queue history.
- Added Supabase migration 11_V34_COMMUNICATION_CENTRE.sql.

# Changelog

## 3.3.2
- Added manual WhatsApp communication centre.
- Added bill reminder, bill generated and payment received templates.
- Added appointment reminders from Doctor Visit Notes.
- Added admission, discharge and incident-update templates.
- Added custom WhatsApp message composer.
- Marks messages as Opened in WhatsApp for communication history.
- Removed dependence on Twilio Send/Retry buttons in manual mode.
- Existing billing transactions continue to queue bill and payment messages automatically.
- No Supabase SQL changes required.

# Changelog

## 3.3.1
- Disabled saved-login persistence on browsers and installed apps.
- Requires Login ID and password on every fresh launch.
- Keeps normal authenticated access during the current active session.
- No Supabase SQL changes required.

# Changelog

## 3.3.0
- Replaced the long sidebar and two-panel tabs with accordion navigation.
- Added Operations, Care, Clinical, and Quality & Records sections.
- Only one section stays expanded at a time.
- Preserved all V3.2 modules, including Clinical Intelligence.
- Increased menu readability on desktop and mobile.
- Remembers the last open navigation section.
- No Supabase SQL changes required.

# Changelog

## 3.2.3
- Replaced the crowded sidebar with two navigation panels: Operations and Clinical.
- Added large readable navigation text.
- Added one-click switching between menu panels.
- Automatically opens the correct panel when navigating.
- Remembers the last selected panel.
- No Supabase SQL changes required.

# Changelog

## 3.2.2
- Made the left navigation panel independently scrollable.
- Preserved readable menu font size.
- Kept the cloud connection footer fixed at the bottom.
- Improved sidebar fit on smaller laptop screens.
- No Supabase SQL changes required.

# Changelog

## 3.2.1
- Fixed blank Clinical Intelligence page caused by a page-route naming mismatch.
- No Supabase SQL changes required.

# Changelog

## 3.2.0
- Added Morse Fall Scale with automatic scoring and risk category.
- Added Braden pressure-ulcer risk assessment.
- Added structured Pain Assessment.
- Added resident Care Plans.
- Added Doctor Visit Notes and follow-up date.
- Added Nutrition Assessment.
- Added Clinical Intelligence dashboard with high-risk summaries.
- Added printable/PDF clinical assessment view.
- Added Supabase migration 10_V32_CLINICAL_INTELLIGENCE.sql.

# Changelog

## 3.1.0
- Added Nursing Notes with permanent staff attribution.
- Added Shift Handover with priority and pending tasks.
- Added Medication Administration Record (MAR).
- Added unified Resident Timeline combining clinical, care, incident, document and billing events.
- Added printable/PDF-friendly layouts.
- Added Supabase migration 09_V31_CARE_TIMELINE.sql.

# Changelog

## 2.4.0
- Added secure Twilio WhatsApp and SMS delivery through Supabase Edge Functions.
- Added Send Pending Now and per-message Send/Retry controls.
- Added provider delivery status, sent timestamp and error display.
- Kept Twilio credentials out of GitHub and browser code.
- Added WhatsApp Sandbox support and optional Twilio SMS sender support.

# Changelog

## 2.3.0
- Added Administrator-only Employee Profile popup.
- Added employee photo capture by laptop/Windows webcam, mobile camera, or file upload.
- Added employee certificate and document upload/viewing.
- Added personal, employment, qualification and emergency-contact details.
- Added profile editing and confidential access controls.

# Changelog

## 2.1.1
- Fixed Add Patient form not opening.
- Fixed Edit Patient form not opening.
- Added missing selectWithValue form helper.
- Retained working Documents, Profile, Payment and webcam photo actions.


## 2.1.0
- Fixed Add Patient, Edit and Documents buttons with robust delegated actions.
- Added live Windows/laptop webcam capture for patient profile photographs.
- Added centred square portrait capture and immediate Supabase upload.
- Retained mobile camera and gallery photo options.

# Samara Care ERP V2 Changelog

## 2.0.0
- Complete professional visual redesign.
- New branded login experience.
- Icon-based collapsible navigation.
- Modern dashboard welcome panel and metric cards.
- Improved patient profile sizing and mobile layout.
- Consistent forms, tables, billing, clinical and document styling.
- Preserves existing Supabase authentication, database and storage.
- Updated PWA cache and realtime channel version.
