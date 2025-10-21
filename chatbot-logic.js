// Thay vì dùng google.genai, chúng ta IMPORT GoogleGenAI
import { GoogleGenAI } from './genai.js'; // Đường dẫn đến tệp genai.js

// **********************************************
// ⚠️ QUAN TRỌNG: Thay Khóa API của bạn vào đây!
// **********************************************
const GEMINI_API_KEY = "AIzaSyD97_1KT7bYgrjaDIV-UhwdUT_NCVr64tA"; 

// 1. Khởi tạo Gemini Client
// Lưu ý: Vì ta dùng import, GenAI Client đã được định nghĩa trong genai.js
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const modelName = 'gemini-2.5-flash';

// Lời nhắc hệ thống để định hướng vai trò
const systemInstruction = `Bạn là Robot NAO, một trợ lý thân thiện, kiên nhẫn và luôn cười, chuyên về Kỹ năng Công dân số cho học sinh tiểu học (từ 6 đến 11 tuổi). 
Hãy trả lời ngắn gọn, đơn giản, dễ hiểu và tích cực, luôn bắt đầu bằng "🤖 NAO:". 
Nếu câu hỏi không liên quan đến Công dân số, an toàn mạng, hay robot, hãy lịch sự từ chối bằng cách nói rằng bạn chỉ biết về Công dân số.`;


document.addEventListener('DOMContentLoaded', function() {
    // Lấy các phần tử HTML
    const container = document.getElementById('naoChatbotContainer');
    const toggleButton = document.getElementById('naoChatbotToggle');
    const contentArea = document.getElementById('chatbotContent');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');

    // *************** A. LOGIC ĐÓNG/MỞ KHUNG ***************
    function toggleChatbot() {
        container.classList.toggle('open');
        if (container.classList.contains('open')) {
            contentArea.scrollTop = contentArea.scrollHeight;
            userInput.focus();
        }
    }
    toggleButton.addEventListener('click', toggleChatbot);

    // *************** B. LOGIC GỌI GEMINI ***************
    
    // Hàm tạo và hiển thị tin nhắn
    function displayMessage(text, sender) {
        const messageElement = document.createElement('p');
        messageElement.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
        messageElement.textContent = text;
        contentArea.appendChild(messageElement);
        contentArea.scrollTop = contentArea.scrollHeight;
        return messageElement;
    }

    // Hàm chính xử lý gửi tin nhắn
    async function sendMessage() {
        const userText = userInput.value.trim();
        if (userText === '') return;

        displayMessage(userText, 'user');
        userInput.value = '';
        
        const typingIndicator = displayMessage("🤖 NAO đang nghĩ...", 'bot');

        try {
            // 2. Gọi Gemini API
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: userText }] }],
                config: {
                    systemInstruction: systemInstruction,
                }
            });

            // 3. Xóa tin nhắn "đang gõ" và hiển thị kết quả
            contentArea.removeChild(typingIndicator);
            const botResponse = response.text.trim();
            displayMessage(botResponse, 'bot');

        } catch (error) {
            console.error("Lỗi khi gọi Gemini API:", error);
            contentArea.removeChild(typingIndicator);
            displayMessage("🤖 NAO: Xin lỗi, tớ đang gặp sự cố kết nối. Bạn thử hỏi lại nhé! (Kiểm tra lại Khóa API)", 'bot');
        }
    }

    // Gắn sự kiện gửi tin nhắn (click và nhấn Enter)
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });
});