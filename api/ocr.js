// Vercel Serverless Function — POST /api/ocr
// Proxies image text-detection requests to Google Cloud Vision so the API
// key never touches the browser. Deployed automatically by Vercel from
// this file's location in /api.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: "OCR is not configured on the server yet." })
  }

  const { image } = req.body || {}
  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "Missing 'image' (base64-encoded, no data: prefix)." })
  }

  try {
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: image },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      }
    )

    const data = await visionResponse.json()

    if (!visionResponse.ok) {
      const message = data?.error?.message || "Vision API request failed"
      return res.status(visionResponse.status).json({ error: message })
    }

    const annotation = data?.responses?.[0]?.fullTextAnnotation?.text || ""

    if (!annotation) {
      return res.status(200).json({ text: "", warning: "No text detected in the image." })
    }

    return res.status(200).json({ text: annotation })
  } catch (err) {
    console.error("OCR proxy error:", err)
    return res.status(500).json({ error: "OCR request failed. Please try again." })
  }
}
