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
            text: `วิเคราะห์และแปลงข้อมูลทั้งหมดในไฟล์นี้เป็น JSON เท่านั้น ห้ามมีข้อความอื่น
ให้ดึงข้อมูลทุกฟิลด์ที่มีในเอกสาร เช่น ตาราง รายการ ข้อความสำคัญ
ตอบเป็น JSON format: {"rows": [{"คอลัมน์1": "ค่า", "คอลัมน์2": "ค่า"}], "raw": "ข้อความดิบทั้งหมด"}
ถ้าเป็นตาราง ให้ใช้ header เป็น key
ถ้าไม่ใช่ตาราง ให้ใช้ {"ลำดับ": "1", "ข้อมูล": "...", "หมายเหตุ": "..."}`
          }
        ]
      }]
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
      const clean = text.replace(/```json|```/g, '').trim();
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
