// netlify/functions/chat.mjs
// Hàm chạy trên máy chủ Netlify: giữ Khóa API bí mật, gọi Gemini thay cho trình duyệt.
// Khóa API đặt trong Netlify > Environment variables, tên: GEMINI_API_KEY

const SYSTEM_INSTRUCTION = `Bạn là Robot NAO, một trợ lý thân thiện, kiên nhẫn và luôn cười, chuyên về Kỹ năng Công dân số cho học sinh tiểu học (từ 6 đến 11 tuổi).
Hãy trả lời ngắn gọn (tối đa 4 câu), đơn giản, dễ hiểu và tích cực, luôn bắt đầu bằng "🤖 NAO:".
Nếu câu hỏi không liên quan đến Công dân số, an toàn mạng, hay robot, hãy lịch sự từ chối bằng cách nói rằng bạn chỉ biết về Công dân số.`;

// Model nhẹ trước (hạn mức cao hơn, trả lời nhanh), hết lượt thì thử model còn lại.
// Mỗi model có hạn mức riêng nên dùng 2 model giúp phục vụ được nhiều lượt hơn.
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

async function callGemini(model, text, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          maxOutputTokens: 300,
          thinkingConfig: { thinkingBudget: 0 }, // tắt "suy nghĩ" để trả lời nhanh hơn
        },
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "missing_key" }, { status: 500 });
  }

  let message = "";
  try {
    ({ message } = await req.json());
  } catch {}
  message = String(message || "").trim().slice(0, 300); // giới hạn độ dài câu hỏi
  if (!message) {
    return Response.json({ error: "empty" }, { status: 400 });
  }

  // Không chờ lâu ở máy chủ (Netlify cắt hàm sau ~10 giây).
  // Nếu bận, trả lỗi "busy" để trình duyệt tự chờ rồi hỏi lại.
  let lastStatus = 0;
  let lastDetail = "";
  for (const model of MODELS) {
    try {
      const { status, data } = await callGemini(model, message, apiKey);
      if (status === 200) {
        const reply = (data?.candidates?.[0]?.content?.parts || [])
          .map((p) => p.text || "")
          .join("")
          .trim();
        return Response.json({
          reply: reply || "🤖 NAO: Tớ chưa nghĩ ra câu trả lời, bạn hỏi cách khác nhé!",
        });
      }
      lastStatus = status;
      lastDetail = data?.error?.message || "";
      // Ghi lỗi vào nhật ký Netlify (Logs > Functions > chat) để dễ tìm nguyên nhân
      console.error(`Gemini ${model} lỗi ${status}: ${lastDetail}`);
      if (status === 400 || status === 401 || status === 403) break; // sai khóa: không thử tiếp
    } catch (e) {
      lastStatus = 0;
      lastDetail = String(e);
      console.error("Không gọi được Gemini:", e);
    }
  }

  const detail = `${lastStatus} ${lastDetail}`.trim();
  if (lastStatus === 429 || lastStatus === 500 || lastStatus === 503) {
    // Hết lượt/phút hoặc Gemini quá tải: trình duyệt sẽ xếp hàng rồi hỏi lại
    return Response.json({ error: "busy", detail }, { status: 503 });
  }
  // Các lỗi khác (sai khóa, sai model...): không hỏi lại, báo bảo trì
  return Response.json({ error: "bad_key", detail }, { status: 500 });
};

export const config = { path: "/api/chat" };
