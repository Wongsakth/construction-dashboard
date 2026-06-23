exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) };
  }

  try {
    const { base64, mimeType } = JSON.parse(event.body);

    const payload = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            }
          },
          {
            text: `You are an OCR expert. Extract ALL text and data from this image/document.
Return ONLY valid JSON, no markdown, no explanation.
Format: {"rows": [{"column1": "value", "column2": "value"}], "raw": "all extracted text"}
Rules:
- If it contains a table: use table headers as JSON keys, each row = one object in rows array
- If it contains a list or items: use {"ลำดับ": "1", "ข้อมูล": "...", "หมายเหตุ": "..."}
- If it contains key-value pairs: use {"หัวข้อ": "...", "ค่า": "..."}
- Always fill "raw" with ALL extracted text
- Extract every piece of text visible in the image
- Support Thai and English text`
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      }
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();

    if (data.error) {
      return { statusCode: 500, body: JSON.stringify({ error: data.error.message }) };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(clean);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      };
    } catch {
      // fallback: return raw text as single row
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ ข้อมูล: text }], raw: text }),
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
