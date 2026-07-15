import { useState, useRef } from "react"

// Simulated OCR extraction — replace this function with real Google Vision API call later.
// NOTE: per the security requirements, we never persist the raw image — only
// the extracted text fields are kept, and the preview URL is revoked on close.
function simulateOCR(file) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        full_name: "Auto-detected from ID",
        date_of_birth: "1990-01-01",
        license_number: "D" + Math.floor(Math.random() * 900000000 + 100000000),
        license_state: "TX",
        expiration_date: "2029-01-01",
      })
    }, 2000) // simulate 2 second processing time
  })
}

export function DriverLicenseScanner({ onScanComplete }) {
  const [isOpen, setIsOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [preview, setPreview] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const handleFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, etc.)")
      return
    }
    setError(null)
    setScanResult(null)
    setPreview(URL.createObjectURL(file))
    setScanning(true)

    try {
      const result = await simulateOCR(file)
      setScanResult(result)
    } catch (err) {
      setError("Failed to scan ID. Please try again or enter details manually.")
    }
    setScanning(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const handleApply = () => {
    if (scanResult) {
      onScanComplete(scanResult)
      handleClose()
    }
  }

  const handleClose = () => {
    if (preview) URL.revokeObjectURL(preview) // discard the image reference — never stored
    setIsOpen(false)
    setPreview(null)
    setScanResult(null)
    setError(null)
    setScanning(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Scan Driver's License
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Scan Driver's License / ID</h2>
                <p className="text-sm text-slate-500">
                  Upload a photo of your government ID to verify your identity
                </p>
              </div>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!preview ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-10 text-center hover:border-indigo-400 cursor-pointer"
                onClick={() => fileRef.current.click()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium text-slate-600">Drop your ID image here</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse — JPG, PNG supported</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-slate-200">
                  <img src={preview} alt="Government ID" className="w-full object-cover max-h-48" />
                  {scanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent mb-2"></div>
                      <p className="text-white text-sm font-medium">Scanning ID...</p>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                {scanResult && (
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-2">
                    <p className="text-sm font-semibold text-green-800 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      ID scanned successfully
                    </p>
                    {Object.entries(scanResult).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-slate-500 capitalize">{key.replace(/_/g, " ")}</span>
                        <span className="font-medium text-slate-800">{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setPreview(null); setScanResult(null) }}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Scan Again
                  </button>
                  {scanResult && (
                    <button
                      type="button"
                      onClick={handleApply}
                      className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Verify Identity
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
