// Plain-language names for verification flags. Flags are hints for a verifier, never verdicts.
export const flagLabels: Record<string, string> = {
  missing_gps: "No location in photo",
  location_from_device: "Location from phone only",
  outside_boundary: "Outside project boundary",
  device_gps_mismatch: "Photo and phone locations disagree",
  missing_capture_time: "No capture time",
  capture_time_implausible: "Implausible capture time",
  captured_before_planting: "Taken before planting date",
  exact_duplicate: "Exact duplicate of another upload",
  similar_image: "Looks like another photo",
  low_resolution: "Low resolution",
};

export const flagLabel = (f: string) => flagLabels[f] ?? f.replaceAll("_", " ");
