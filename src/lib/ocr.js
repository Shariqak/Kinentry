// Client-side OCR helper. Sends the image to our own /api/ocr serverless
// function (never directly to Google — the API key stays server-side) and
// parses the returned raw text into the structured fields each scanner needs.
//
// IMPORTANT: per the "no raw ID images stored" security requirement, the
// image is sent for one-shot text extraction and never written to Supabase
// storage or any table — only the parsed text fields are kept.

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // reader.result looks like "data:image/png;base64,AAAA..." — strip the prefix
      const base64 = reader.result.split(",")[1]
      resolve(base64)
    }
    reader.onerror = () => reject(new Error("Could not read the image file."))
    reader.readAsDataURL(file)
  })
}

/**
 * Sends an image file to the OCR endpoint and returns the raw extracted text.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromImage(file) {
  const base64 = await fileToBase64(file)

  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64 }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || "OCR request failed.")
  }

  if (!data.text) {
    throw new Error(data.warning || "No text could be read from that image. Try a clearer photo.")
  }

  return data.text
}

// --- Field parsers -----------------------------------------------------
// Card layouts vary a lot between insurers/states, so these use forgiving,
// label-based regexes and fall back to leaving a field blank rather than
// guessing wrong — the patient/staff can always fill gaps in manually on
// the form afterward.

// Lines that are clearly document chrome, not a person's or company's name —
// skipped when falling back to "first all-caps line" heuristics.
const HEADER_NOISE = /\b(DRIVER|LICENSE|IDENTIFICATION|DEPARTMENT|STATE OF|USA|UNITED STATES|CARD|GOVERNMENT|MOTOR VEHICLE)\b/i

const STATE_NAMES = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA",
  COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE", FLORIDA: "FL", GEORGIA: "GA",
  HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA",
  KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME", MARYLAND: "MD",
  MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS", MISSOURI: "MO",
  MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV", "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", OHIO: "OH",
  OKLAHOMA: "OK", OREGON: "OR", PENNSYLVANIA: "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT", VERMONT: "VT",
  VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV", WISCONSIN: "WI", WYOMING: "WY",
}

function findAfterLabel(text, labels) {
  for (const label of labels) {
    const re = new RegExp(`\\b${label}\\b\\s*[:#]?\\s*([A-Za-z0-9\\-\\/ ]{2,30})`, "i")
    const match = text.match(re)
    if (match) return match[1].trim()
  }
  return null
}

function findDate(text, labels, allowFallback = true) {
  for (const label of labels) {
    const re = new RegExp(`\\b${label}\\b[^0-9]{0,5}(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`, "i")
    const match = text.match(re)
    if (match) return normalizeDate(match[1])
  }
  if (!allowFallback) return null
  // fallback: grab the first date-looking token anywhere in the text
  const anyDate = text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/)
  return anyDate ? normalizeDate(anyDate[1]) : null
}

function normalizeDate(raw) {
  const parts = raw.split(/[\/\-]/)
  if (parts.length !== 3) return null
  let [a, b, c] = parts
  if (c.length === 2) c = "20" + c // assume 2000s for 2-digit years
  // Most US cards are MM/DD/YYYY
  const [mm, dd, yyyy] = [a.padStart(2, "0"), b.padStart(2, "0"), c]
  return `${yyyy}-${mm}-${dd}`
}

function findName(text) {
  // Prefer an explicit "Name:" label if present
  const labeled = findAfterLabel(text, ["Name", "Member Name", "Policy Holder", "Insured"])
  if (labeled) return labeled

  // Fallback: driver's licenses often print the person's name as an
  // all-caps line with no explicit label — but so are header lines like
  // "TEXAS" or "DRIVER LICENSE", so skip anything that looks like chrome.
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const capsLine = lines.find(
    (l) =>
      /^[A-Z][A-Z\s,.'-]{4,40}$/.test(l) &&
      l.split(" ").length >= 2 &&
      !HEADER_NOISE.test(l) &&
      !(l.toUpperCase() in STATE_NAMES)
  )
  return capsLine || null
}

function findLicenseState(text) {
  // Try a two-letter abbreviation near "DRIVER"/"LICENSE" first
  const abbrMatch = text.match(/\b([A-Z]{2})\b\s*(DRIVER|LICENSE|DEPT)/i)
  if (abbrMatch) return abbrMatch[1].toUpperCase()

  // Fall back to a spelled-out state name anywhere in the text
  const upperText = text.toUpperCase()
  for (const [name, abbr] of Object.entries(STATE_NAMES)) {
    if (upperText.includes(name)) return abbr
  }
  return null
}

/**
 * @param {string} text - raw OCR text from an insurance card
 */
export function parseInsuranceCardText(text) {
  const provider =
    findAfterLabel(text, ["Insurance Company", "Insurer", "Health Plan", "Carrier"]) ||
    (() => {
      // Fall back to the first all-caps header line (insurers print their
      // name prominently at the top, with no explicit label).
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
      return (
        lines.find(
          (l) => /^[A-Z][A-Z\s&,.'-]{2,40}$/.test(l) && !/\d/.test(l) && !HEADER_NOISE.test(l)
        ) || null
      )
    })()

  return {
    insurance_provider: provider,
    member_id: findAfterLabel(text, ["Member ID", "Member No", "ID Number", "Subscriber ID", "ID"]),
    group_number: findAfterLabel(text, ["Group Number", "Group No", "Group ID", "Grp"]),
    plan_type: findAfterLabel(text, ["Plan Type", "Type"]),
    policy_holder: findName(text),
  }
}

/**
 * @param {string} text - raw OCR text from a driver's license / government ID
 */
export function parseDriverLicenseText(text) {
  return {
    full_name: findName(text),
    date_of_birth: findDate(text, ["DOB", "Date of Birth", "Birth"]),
    license_number: findAfterLabel(text, ["DL", "License No", "License Number", "ID Number", "LIC"]),
    license_state: findLicenseState(text),
    expiration_date: findDate(text, ["EXP", "Expires", "Expiration"], false),
  }
}
