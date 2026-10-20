// chatbot-logic.js — phía trình duyệt. KHÔNG chứa Khóa API.
// Câu hỏi được gửi tới /api/chat (hàm Netlify), hàm đó mới gọi Gemini.

// ===== 1. CÂU TRẢ LỜI CÓ SẴN (không tốn lượt gọi Gemini) =====
// Mỗi mục có "need": danh sách NHÓM từ khóa. Câu hỏi phải chứa ít nhất 1 từ
// trong MỖI nhóm thì mới khớp. Mục khớp nhiều nhóm nhất (cụ thể nhất) sẽ được chọn.
// Từ khóa viết KHÔNG DẤU, chữ thường (học sinh gõ có dấu hay không dấu đều nhận).
// Thầy cô có thể thêm/sửa các mục bên dưới cho hợp bài học.
const FAQ = [
  // --- Mật khẩu ---
  {
    need: [["mat khau", "password", "pass"], ["nguoi la", "nguoi khong quen", "nguoi tren mang", "ai do", "nguoi khac"], ["cho", "dua", "gui", "noi", "chia se", "tiet lo", "xin"]],
    answer: "🤖 NAO: KHÔNG bao giờ nhé! Mật khẩu là bí mật của riêng bạn, giống như chìa khóa nhà. Người lạ xin mật khẩu thường là để lấy trộm tài khoản. Bạn hãy từ chối, không trả lời và kể ngay cho bố mẹ hoặc thầy cô biết.",
  },
  {
    need: [["mat khau", "password", "pass"], ["ban than", "ban be", "ban cung lop", "ban minh", "cho ban"]],
    answer: "🤖 NAO: Không nên đâu! Kể cả bạn thân cũng không nên biết mật khẩu của bạn. Bạn bè có thể vô tình nói cho người khác, hoặc lỡ đăng nhập làm mất bài của bạn. Chỉ bố mẹ (người giám hộ) mới nên biết mật khẩu thôi nhé!",
  },
  {
    need: [["mat khau", "password"], ["tao", "dat", "manh", "nhu the nao", "the nao", "cach", "an toan"]],
    answer: "🤖 NAO: Mật khẩu mạnh nên dài ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký hiệu (ví dụ: Meo@Vang2026). Đừng dùng tên, ngày sinh hay 123456. Mỗi tài khoản nên có mật khẩu khác nhau và nhờ bố mẹ giữ giúp nhé!",
  },
  {
    need: [["mat khau", "password"]],
    answer: "🤖 NAO: Mật khẩu là chìa khóa bảo vệ tài khoản của bạn. Hãy giữ bí mật, không cho bạn bè hay người lạ biết, chỉ bố mẹ được biết thôi. Mật khẩu tốt nên dài và có cả chữ, số, ký hiệu nhé!",
  },
  // --- Người lạ ---
  {
    need: [["nguoi la", "nguoi quen tren mang", "ban tren mang", "ban qua mang"], ["gap", "hen", "di choi", "ra ngoai"]],
    answer: "🤖 NAO: TUYỆT ĐỐI KHÔNG hẹn gặp người chỉ quen trên mạng! Người đó có thể không phải là người như họ nói. Nếu ai rủ bạn đi gặp, hãy từ chối và kể ngay với bố mẹ, thầy cô nhé.",
  },
  {
    need: [["nguoi la", "nguoi khong quen"], ["ket ban", "nhan tin", "lam quen", "noi chuyen", "chat", "kb"]],
    answer: "🤖 NAO: Bạn không nên kết bạn hay nhắn tin riêng với người lạ trên mạng nhé. Trên mạng, người lạ có thể giả làm bạn cùng tuổi. Nếu có người lạ nhắn tin, đừng trả lời mà hãy cho bố mẹ hoặc thầy cô xem.",
  },
  {
    need: [["nguoi la", "nguoi khong quen"]],
    answer: "🤖 NAO: Với người lạ trên mạng, bạn nhớ 3 điều: không kết bạn, không cho thông tin cá nhân, không hẹn gặp. Có gì lạ hãy kể ngay với người lớn mà bạn tin tưởng nhé!",
  },
  // --- Thông tin cá nhân ---
  {
    need: [["thong tin ca nhan", "dia chi", "so dien thoai", "sdt", "ten truong", "nha minh o dau", "ngay sinh"]],
    answer: "🤖 NAO: Họ tên đầy đủ, địa chỉ nhà, số điện thoại, tên trường, ngày sinh là thông tin cá nhân. Bạn đừng đăng lên mạng hay gửi cho người lạ. Nếu có ai hỏi, hãy hỏi ý bố mẹ hoặc thầy cô trước nha!",
  },
  // --- Ảnh ---
  {
    need: [["anh", "hinh", "video", "clip"], ["dang", "chia se", "gui", "up", "dua len"]],
    answer: "🤖 NAO: Trước khi đăng ảnh lên mạng, bạn hãy xin phép bố mẹ và những người có trong ảnh nhé. Đừng đăng ảnh có đồng phục, bảng tên trường hay số nhà, vì người lạ có thể biết bạn ở đâu.",
  },
  // --- Bắt nạt ---
  {
    need: [["bat nat", "chui", "treu", "noi xau", "che gieu", "doa", "de doa", "xuc pham"]],
    answer: "🤖 NAO: Nếu bị ai nói lời xấu trên mạng, bạn đừng trả lời lại. Hãy chụp màn hình, chặn người đó và báo ngay cho bố mẹ, thầy cô. Bạn không có lỗi, và luôn có người lớn sẵn sàng giúp bạn!",
  },
  // --- Đường link lạ, lừa đảo ---
  {
    need: [["link", "duong dan", "trung thuong", "qua tang", "nhan qua", "mien phi", "tin nhan la", "lua dao"]],
    answer: "🤖 NAO: Đừng bấm vào đường link lạ hay tin nhắn báo 'trúng thưởng', 'nhận quà miễn phí' nhé! Đó thường là bẫy lừa đảo để lấy tài khoản hoặc cài virus. Hãy hỏi bố mẹ hoặc thầy cô trước khi bấm.",
  },
  // --- Tải game, ứng dụng ---
  {
    need: [["tai", "cai", "download"], ["game", "tro choi", "ung dung", "app", "phan mem"]],
    answer: "🤖 NAO: Trước khi tải game hay ứng dụng, bạn hãy hỏi bố mẹ nhé. Chỉ tải từ cửa hàng chính thức (CH Play, App Store), không tải từ link lạ, và đọc kỹ xem ứng dụng có phù hợp với lứa tuổi không.",
  },
  // --- Virus ---
  {
    need: [["virus", "vi rut", "ma doc", "hacker", "hack"]],
    answer: "🤖 NAO: Virus máy tính là chương trình xấu có thể làm hỏng máy hoặc lấy trộm thông tin. Để phòng tránh: không bấm link lạ, không tải phần mềm không rõ nguồn gốc, và báo người lớn khi máy chạy bất thường nhé!",
  },
  // --- AI ---
  {
    need: [["ai", "chatbot", "tri tue nhan tao", "gemini", "chatgpt"], ["lam ho", "lam bai", "bai tap", "giai bai", "lam van", "chep"]],
    answer: "🤖 NAO: Nhờ AI làm hộ bài tập là chưa đúng đâu! Bạn sẽ không học được gì. Hãy dùng AI như người bạn gợi ý: hỏi để hiểu bài, xin ý tưởng, rồi tự làm bằng sức của mình nhé!",
  },
  {
    need: [["ai", "chatbot", "tri tue nhan tao"], ["sai", "dung khong", "tin", "chinh xac", "luon dung"]],
    answer: "🤖 NAO: AI rất giỏi nhưng vẫn có thể trả lời SAI đó! Bạn hãy kiểm tra lại bằng sách giáo khoa, hỏi thầy cô hoặc bố mẹ trước khi tin hoàn toàn nhé.",
  },
  {
    need: [["tri tue nhan tao", "ai la gi", "ai la cai gi"]],
    answer: "🤖 NAO: AI (trí tuệ nhân tạo) là chương trình máy tính có thể học hỏi, trả lời câu hỏi, vẽ tranh… giống như tớ vậy! AI giúp ta học tốt hơn, nhưng cần dùng đúng cách và luôn có người lớn hướng dẫn nhé.",
  },
  // --- Thời gian dùng thiết bị ---
  {
    need: [["choi game", "dung may tinh", "dung dien thoai", "xem youtube", "thoi gian", "bao lau", "nhieu gio"]],
    answer: "🤖 NAO: Bạn nên dùng thiết bị điện tử vừa phải, không quá 1–2 giờ mỗi ngày để giải trí. Cứ 20 phút hãy nhìn xa 20 giây cho mắt nghỉ ngơi, và dành thời gian chơi thể thao, đọc sách nữa nhé!",
  },
  // --- Tin giả ---
  {
    need: [["tin gia", "tin don", "tin that", "tin dung khong", "fake"]],
    answer: "🤖 NAO: Không phải tin nào trên mạng cũng đúng! Trước khi tin hay chia sẻ, bạn hãy xem tin đó từ đâu, có báo uy tín nào đưa không, và hỏi bố mẹ, thầy cô nhé.",
  },
  // --- Công dân số ---
  {
    need: [["cong dan so"]],
    answer: "🤖 NAO: Công dân số là người biết dùng Internet và thiết bị số an toàn, lịch sự và có trách nhiệm: bảo vệ thông tin cá nhân, tôn trọng người khác trên mạng và dùng công nghệ để học tập tốt hơn. Bạn cũng là một công dân số đó!",
  },
  // --- Chào hỏi (giữ mục này ở CUỐI) ---
  {
    need: [["xin chao", "chao nao", "chao ban", "hello", "hi nao", "ban ten gi", "ban la ai", "ten ban"]],
    answer: "🤖 NAO: Chào bạn! Tớ là NAO, robot giúp bạn học Kỹ năng Công dân số. Bạn muốn hỏi tớ về mật khẩu, người lạ trên mạng hay cách dùng AI đúng cách nào?",
  },
];

// Bỏ dấu tiếng Việt để so khớp
function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();
}

function findFaqAnswer(text) {
  const t = " " + normalize(text).replace(/[!.?,]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  // Lời chào ngắn: trả lời ngay
  if ([" hi ", " chao ", " alo ", " hello ", " xin chao "].includes(t)) return FAQ[FAQ.length - 1].answer;
  // so khớp theo cả từ (tránh "ai" khớp nhầm với "tai", "sai"...)
  const has = (k) => t.includes(" " + k + " ") || (k.includes(" ") && t.includes(k));
  let best = null;
  for (const item of FAQ) {
    if (item.need.every((group) => group.some(has))) {
      if (!best || item.need.length > best.need.length) best = item;
    }
  }
  return best ? best.answer : null;
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
