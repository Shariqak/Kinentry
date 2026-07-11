import { useState, useRef } from "react"

// Simulated OCR extraction — replace this function with real Google Vision API call later
function simulateOCR(file) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        insurance_provider: "Blue Cross Blue Shield",
        member_id: "BCB" + Math.floor(Math.random() * 9000000 + 1000000),
        group_number: "GRP" + Math.floor(Math.random() * 90000 + 10000),
        plan_type: "PPO",
        policy_holder: "Auto-detected from card",
      })
    }, 2000) // simulate 2 second processing time
  })
}

export function InsuranceCardScanner({ onScanComplete }) {
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
      setError("Failed to scan card. Please try again or enter details manually.")
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
      setIsOpen(false)
      setPreview(null)
      setScanResult(null)
    }
  }

  const handleClose = () => {
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
        className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Scan Insurance Card
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Scan Insurance Card</h2>
                <p className="text-sm text-slate-500">Upload a photo of your insurance card to auto-fill your details</p>
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
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-10 text-center hover:border-blue-400 cursor-pointer"
                onClick={() => fileRef.current.click()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium text-slate-600">Drop your insurance card image here</p>
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
                  <img src={preview} alt="Insurance card" className="w-full object-cover max-h-48" />
                  {scanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent mb-2"></div>
                      <p className="text-white text-sm font-medium">Scanning card...</p>
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
                      Card scanned successfully
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
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Apply to Profile
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
