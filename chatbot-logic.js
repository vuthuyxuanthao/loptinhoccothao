// chatbot-logic.js — phía trình duyệt. KHÔNG chứa Khóa API.
// Câu hỏi được gửi tới /api/chat (hàm Netlify), hàm đó mới gọi Gemini.

// ===== 1. CÂU TRẢ LỜI CÓ SẴN (không tốn lượt gọi Gemini) =====
// Câu hỏi nào chứa một trong các từ khóa sẽ được trả lời ngay.
// Thầy cô có thể thêm/sửa các mục bên dưới cho hợp bài học.
const FAQ = [
  {
    keys: ["mật khẩu", "mat khau", "password"],
    answer: "🤖 NAO: Mật khẩu giống như chìa khóa nhà vậy! Bạn chỉ cho bố mẹ biết thôi, không đưa cho bạn bè hay người lạ. Mật khẩu tốt nên dài, có cả chữ và số nhé!",
  },
  {
    keys: ["thông tin cá nhân", "thong tin ca nhan", "địa chỉ nhà", "số điện thoại"],
    answer: "🤖 NAO: Tên trường, địa chỉ nhà, số điện thoại là thông tin cá nhân. Bạn đừng chia sẻ lên mạng hay gửi cho người lạ. Nếu có ai hỏi, hãy báo ngay cho bố mẹ hoặc thầy cô nha!",
  },
  {
    keys: ["người lạ", "nguoi la", "kết bạn"],
    answer: "🤖 NAO: Trên mạng có thể có người lạ giả làm bạn. Bạn không nhận lời kết bạn, không nói chuyện riêng và không hẹn gặp người lạ. Hãy kể với người lớn mà bạn tin tưởng nhé!",
  },
  {
    keys: ["bắt nạt", "bat nat", "chửi", "trêu"],
    answer: "🤖 NAO: Nếu ai đó nói lời xấu với bạn trên mạng, bạn đừng trả lời lại. Hãy chụp màn hình và báo cho bố mẹ, thầy cô ngay. Bạn không có lỗi đâu, và luôn có người giúp bạn!",
  },
  {
    keys: ["xin chào", "xin chao", "chào nao", "chào bạn", "hello", "hi nao", "bạn tên gì", "ban ten gi", "bạn là ai"],
    answer: "🤖 NAO: Chào bạn! Tớ là NAO. Bạn muốn hỏi tớ về mật khẩu, thông tin cá nhân hay cách dùng Internet an toàn nào?",
  },
];

function findFaqAnswer(text) {
  const t = text.toLowerCase().trim().replace(/[!.?]+$/, "");
  // Lời chào ngắn: trả lời ngay
  if (["hi", "chào", "chao", "alo", "hello", "xin chào"].includes(t)) return FAQ[FAQ.length - 1].answer;
  const hit = FAQ.find((item) => item.keys.some((k) => t.includes(k)));
  return hit ? hit.answer : null;
}

// ===== 2. CÀI ĐẶT CHỜ & THỬ LẠI =====
const RETRY_DELAYS = [4000, 8000]; // nếu bận: chờ 4s rồi 8s và hỏi lại
const COOLDOWN_MS = 8000; // mỗi bạn phải chờ 8 giây giữa 2 câu hỏi

const MESSAGES = {
  waiting: (s) => `🤖 NAO: Nhiều bạn đang hỏi cùng lúc, tớ xếp hàng một chút nhé... (${s} giây)`,
  busy: "🤖 NAO: Hiện có rất nhiều bạn đang hỏi. Bạn chờ khoảng 1 phút rồi hỏi lại tớ nhé!",
  maintenance: "🤖 NAO: Tớ đang được thầy cô bảo trì. Bạn quay lại sau nhé!",
  offline: "🤖 NAO: Hình như máy bạn đang mất mạng. Bạn kiểm tra Internet rồi hỏi lại nhé!",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("naoChatbotContainer");
  const toggleButton = document.getElementById("naoChatbotToggle");
  const contentArea = document.getElementById("chatbotContent");
  const userInput = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");

  // Đánh thức máy chủ ngay khi mở trang (không tốn lượt Gemini)
  fetch("/api/chat").catch(() => {});

  // A. Đóng/mở khung
  toggleButton.addEventListener("click", function () {
    container.classList.toggle("open");
    if (container.classList.contains("open")) {
      contentArea.scrollTop = contentArea.scrollHeight;
      userInput.focus();
    }
  });

  function displayMessage(text, sender) {
    const el = document.createElement("p");
    el.classList.add(sender === "user" ? "user-message" : "bot-message");
    el.textContent = text;
    contentArea.appendChild(el);
    contentArea.scrollTop = contentArea.scrollHeight;
    return el;
  }

  // Khóa nút Gửi trong lúc chờ và đếm ngược thời gian nghỉ
  function lockInput(ms) {
    sendButton.disabled = true;
    userInput.disabled = true;
    let left = Math.ceil(ms / 1000);
    sendButton.textContent = left + "s";
    const timer = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(timer);
        sendButton.disabled = false;
        userInput.disabled = false;
        sendButton.textContent = "Gửi";
        userInput.focus();
      } else {
        sendButton.textContent = left + "s";
      }
    }, 1000);
  }

  // Gọi máy chủ, tự thử lại khi bận
  async function askServer(text, typingEl) {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      let res, data;
      try {
        // Không chờ quá 20 giây cho mỗi lần hỏi
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        try {
          res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text }),
            signal: ctrl.signal,
          });
          data = await res.json().catch(() => ({}));
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        if (!navigator.onLine) return MESSAGES.offline;
        data = { error: "busy" };
      }

      if (res && res.ok && data.reply) {
        if (data.ms) console.log("NAO trả lời bằng", data.model, "trong", data.ms, "ms");
        return data.reply;
      }
      if (data.detail) console.warn("Chi tiết lỗi:", data.detail);
      if (res && res.status === 404) {
        console.warn("Không tìm thấy /api/chat — kiểm tra thư mục netlify/functions");
        return MESSAGES.maintenance;
      }
      if (data.error === "bad_key" || data.error === "missing_key") {
        return MESSAGES.maintenance + (data.detail ? " (Mã lỗi: " + data.detail.slice(0, 80) + ")" : "");
      }

      // Bận: chờ rồi thử lại (thêm chút ngẫu nhiên để các máy không hỏi lại cùng lúc)
      if (attempt < RETRY_DELAYS.length) {
        const wait = RETRY_DELAYS[attempt] + Math.floor(Math.random() * 2000);
        typingEl.textContent = MESSAGES.waiting(Math.round(wait / 1000));
        await sleep(wait);
        typingEl.textContent = "🤖 NAO đang nghĩ...";
      }
    }
    return MESSAGES.busy;
  }

  let busy = false;

  // B. Gửi câu hỏi
  async function sendMessage() {
    const userText = userInput.value.trim();
    if (userText === "" || busy) return;

    busy = true;
    sendButton.disabled = true;
    displayMessage(userText, "user");
    userInput.value = "";

    // Câu hỏi quen thuộc: trả lời ngay, không cần gọi Gemini
    const faq = findFaqAnswer(userText);
    if (faq) {
      displayMessage(faq, "bot");
      busy = false;
      lockInput(3000);
      return;
    }

    const typing = displayMessage("🤖 NAO đang nghĩ...", "bot");
    // Hiện số giây đang chờ để học sinh biết NAO vẫn đang làm việc
    let sec = 0;
    const tick = setInterval(() => {
      sec++;
      if (typing.textContent.startsWith("🤖 NAO đang nghĩ")) {
        typing.textContent = "🤖 NAO đang nghĩ" + ".".repeat((sec % 3) + 1) + " (" + sec + " giây)";
      }
    }, 1000);
    const reply = await askServer(userText, typing);
    clearInterval(tick);
    typing.remove();
    displayMessage(reply, "bot");

    busy = false;
    lockInput(COOLDOWN_MS);
  }

  sendButton.addEventListener("click", sendMessage);
  userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
});
