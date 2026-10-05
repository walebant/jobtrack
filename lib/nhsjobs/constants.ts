// Shared with the browser, so this file must not import the HTML parser.

// NHS Jobs (jobs.nhs.uk), the national NHS job site run by NHS Business Services Authority.
// Its terms allow downloading extracts for personal, non-commercial use only.
export const NHS_JOBS_ORIGIN = "https://www.jobs.nhs.uk";

export const STAFF_GROUPS = {
  ADMINISTRATIVE_AND_CLERICAL: "Administrative and Clerical",
  ALLIED_HEALTH_PROF: "Allied Health Professionals",
  CLINICAL_SERVICES: "Additional Clinical Services",
  ESTATES_AND_ANCILLARY: "Estates and Ancillary",
  HEALTHCARE_SCIENTISTS: "Healthcare Scientists",
  MEDICAL_AND_DENTAL: "Medical and Dental",
  NURSING_AND_MIDWIFERY_REGD: "Nursing and Midwifery Registered",
  PROF_SCIENTIFIC_AND_TECHNICAL: "Professional, Scientific and Technical",
} as const;
export type StaffGroup = keyof typeof STAFF_GROUPS;

export const BANDS = {
  BAND_2: "Band 2",
  BAND_3: "Band 3",
  BAND_4: "Band 4",
  BAND_5: "Band 5",
  BAND_6: "Band 6",
  BAND_7: "Band 7",
  BAND_8A: "Band 8a",
  BAND_8B: "Band 8b",
  BAND_8C: "Band 8c",
  BAND_8D: "Band 8d",
  BAND_9: "Band 9",
} as const;
export type Band = keyof typeof BANDS;
