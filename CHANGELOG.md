# Changelog

## 3.6.3
- Expanded Intelligent Patient Daily Report.
- Added admission date and length of stay.
- Added referred-by details and reference contact.
- Added diagnosis, treating doctor, hospital, emergency contact and guardian details.
- Added detailed payment and billing information.
- Added abnormal vital-sign and clinical-alert table with date, time, severity and reading.
- Added clearer nursing, care, diet, medicine, incident and doctor-review narrative.
- Added pending-action and follow-up recommendations.
- No Supabase SQL changes required.

# Changelog

## 3.6.2
- Corrected the central page renderer to convert hyphenated routes to underscore renderer names.
- Fixed Intelligent Reports remaining blank despite the V3.6.1 alias.
- Added a visible error panel instead of silently showing a blank page.
- The route correction also protects future hyphenated modules.
- No Supabase SQL changes required.

# Changelog

## 3.6.1
- Fixed blank Intelligent Reports page caused by a route naming mismatch.
- Patient Daily Report and Daily Operations Report controls now display correctly.
- No Supabase SQL changes required.

# Changelog

## 3.6.0
- Added Intelligent Patient Daily Report.
- Added Intelligent Daily Operations Report.
- Added patient/date selection and automatic narrative generation.
- Summarises vitals, alerts, care, nursing, medicines, diet, incidents, doctor reviews, admissions, discharges, billing and pending work.
- Added management recommendations and follow-up flags.
- Added print and Save as PDF layouts.
- No new Supabase SQL required.

# Changelog

## 3.5.1
- Fixed existing-patient Edit buttons opening the Add Patient form.
- Edit buttons now always pass the selected patient ID to the V3.5 Edit Patient form.
- Existing patient details are loaded correctly for editing.
- No Supabase SQL changes required.

# Changelog

## 3.5.0
- Rebuilt the active Add Patient and Edit Patient forms.
- Added Marital Status.
- Added Date of Birth with automatic age calculation.
- Added Blood Group, Occupation, Religion, Preferred Language and Nationality.
- Added optional Aadhaar Number.
- Added Guardian Name and Guardian Relationship.
- Applied Shri., Smt. and Selvi. consistently in formal communications.
- Preserved the original patient name in database records.
- Added Supabase migration 13_V35_PATIENT_MASTER.sql.

# Changelog

## 3.4.4
- Fixed Marital Status field not appearing in the active Add Patient form.
- Fixed Marital Status field not appearing in the active Edit Patient form.
- Fixed saving and updating marital_status in patient records.
- No additional Supabase SQL required if 12_V343_MARITAL_STATUS_PREFIX.sql was already run.

# Changelog

## 3.4.3
- Added Marital Status to Patient Information.
- Added respectful formal prefixes in Communication Centre messages.
- Male residents use Shri.
- Married female residents use Smt.
- Unmarried female residents use Selvi.
- Existing patient names remain unchanged in the database.
- Added marital status to Patient Profile.
- Added Supabase migration 12_V343_MARITAL_STATUS_PREFIX.sql.

# Changelog

## 3.4.2
- Fixed a duplicate later saveSimple function that overrode the V3.4.1 clinical-alert correction.
- All abnormal vital-sign paths now use one full Clinical Alert generator.
- New alerts use event type CRITICAL_ALERT and the complete editable template.
- Includes patient, observation, severity, time, room/bed and recorded-by staff.
- No Supabase SQL changes required.

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
