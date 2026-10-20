// netlify/functions/chat.mjs
// Hàm chạy trên máy chủ Netlify: giữ Khóa API bí mật, gọi Gemini thay cho trình duyệt.
// Khóa API đặt trong Netlify > Environment variables, tên: GEMINI_API_KEY

const SYSTEM_INSTRUCTION = `Bạn là Robot NAO, một trợ lý thân thiện, kiên nhẫn và luôn cười, chuyên về Kỹ năng Công dân số cho học sinh tiểu học (từ 6 đến 11 tuổi).
Hãy trả lời ngắn gọn (tối đa 4 câu), đơn giản, dễ hiểu và tích cực, luôn bắt đầu bằng "🤖 NAO:".
Nếu câu hỏi không liên quan đến Công dân số, an toàn mạng, hay robot, hãy lịch sự từ chối bằng cách nói rằng bạn chỉ biết về Công dân số.`;

const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

// Netlify dừng hàm sau khoảng 10 giây, nên tổng thời gian chờ phải dưới mức đó
const TOTAL_BUDGET_MS = 9000;

async function callGemini(model, text, apiKey, useThinkingLevel, timeoutMs) {
  const generationConfig = { maxOutputTokens: 400 };
  // Giảm "suy nghĩ" của model để trả lời nhanh (nếu model không hỗ trợ thì bỏ)
  if (useThinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: "minimal" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig,
        }),
      }
    );
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export default async (req) => {
  // "Đánh thức" hàm khi trang vừa mở, để câu hỏi đầu tiên không phải chờ lâu
  if (req.method === "GET") {
    return Response.json({ ok: true });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "missing_key", detail: "Chưa có GEMINI_API_KEY" }, { status: 500 });
  }

  let message = "";
  try {
    ({ message } = await req.json());
  } catch {}
  message = String(message || "").trim().slice(0, 300);
  if (!message) {
    return Response.json({ error: "empty" }, { status: 400 });
  }

  const start = Date.now();
  let lastStatus = 0;
  let lastDetail = "";

  for (const model of MODELS) {
    for (const useThinkingLevel of [true, false]) {
      const left = TOTAL_BUDGET_MS - (Date.now() - start);
      if (left < 1500) break;
      try {
        const { status, data } = await callGemini(model, message, apiKey, useThinkingLevel, left);
        if (status === 200) {
          const reply = (data?.candidates?.[0]?.content?.parts || [])
            .filter((p) => !p.thought)
            .map((p) => p.text || "")
            .join("")
            .trim();
          return Response.json({
            reply: reply || "🤖 NAO: Tớ chưa nghĩ ra câu trả lời, bạn hỏi cách khác nhé!",
            model,
            ms: Date.now() - start, // thời gian Gemini trả lời (để theo dõi)
          });
        }
        lastStatus = status;
        lastDetail = data?.error?.message || "";
        console.error(`Gemini ${model} (thinking=${useThinkingLevel}) lỗi ${status}: ${lastDetail}`);
        if (status === 401 || status === 403) break;
        // Lỗi 400 khi bật thinkingLevel: thử lại cùng model nhưng không bật
        if (status === 400 && useThinkingLevel) continue;
        break; // lỗi khác: chuyển sang model kế tiếp
      } catch (e) {
        lastStatus = 504;
        lastDetail = e.name === "AbortError" ? "Gemini trả lời quá chậm" : String(e);
        console.error(`Gemini ${model}: ${lastDetail}`);
        break;
      }
    }
    if (lastStatus === 401 || lastStatus === 403) break;
  }

  const detail = `${lastStatus} ${lastDetail}`.trim();
  if ([429, 500, 503, 504].includes(lastStatus)) {
    return Response.json({ error: "busy", detail }, { status: 503 });
  }
  return Response.json({ error: "bad_key", detail }, { status: 500 });
};

export const config = { path: "/api/chat" };
