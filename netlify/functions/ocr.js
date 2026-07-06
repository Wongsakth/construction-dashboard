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
            text: `You are an OCR expert for invoices and receipts.
Extract vendor info and line items from this document.

Return ONLY valid JSON, no markdown, no explanation:
{
  "vendor": {
    "name": "ชื่อบริษัท/ร้านค้าผู้ขาย",
    "tax_id": "เลขที่ผู้เสียภาษี ถ้ามี",
    "phone": "เบอร์โทร ถ้ามี"
  },
  "rows": [
    {"ลำดับ": "1", "รายการ": "ชื่อสินค้า", "จำนวน": "21", "หน่วย": "คิว", "ราคา/หน่วย": "1800", "จำนวนเงิน": "37800"}
  ]
}

Rules:
- vendor = ผู้ขาย ไม่ใช่ผู้ซื้อ
- Each product/service line = one row
- If any field not found, use empty string
- Support Thai and English
- Extract ALL line items visible`
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      }
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
