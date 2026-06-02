// Vietnamese is the canonical key source — `keyof typeof vi` (minus
// array-valued keys) is the TranslationKey type. en.ts MUST mirror every
// key here; the i18n unit test asserts dict completeness, so adding a
// key in vi without translating it in en will surface as a test failure.
//
// Most values are strings (UI chrome). A few are `readonly string[]` —
// pools the consumer picks one variant from at runtime. The matcher's
// top-K random pick on the server uses the same "rotate canned answers"
// pattern; same intent here for client-owned text.
//
// Interpolation is caller-side: `t('header.subtitle').replace('{count}',
// String(count))`. The hook deliberately doesn't ship a `t(key, vars)`
// overload — one runtime substitution helper is fine, but a second API
// surface for the dict layer isn't worth the ergonomics tax.

export const vi = {
  "header.subtitle": "Chatbot khớp mẫu · {{ count }} cặp đã học",
  "role.you": "BẠN",
  "role.you.teaching": "BẠN · DẠY",
  // Visual uppercase is CSS (text-transform: uppercase) at the call site;
  // keeping a single canonical brand here means mixed-case acronyms
  // (e.g. "SimML" → "SIMML") render consistently.
  "role.bot": "{{ brand }}",
  "badge.exact": "khớp chính xác",
  "badge.fts": "khớp một phần",
  "badge.trigram": "khớp gần đúng",
  "badge.session_teach": "từ lần dạy trước",
  "badge.lowConfidence": "độ tin cậy thấp",
  "badge.noMatch": "không khớp",
  "badge.score": "điểm",
  "badge.fromLocale": "khớp từ {{ locale }}",
  "cta.teachBetter": "Dạy câu trả lời khác",
  "composer.placeholder": "Nhắn cho {{ brand }}… hoặc /teach <câu trả lời>",
  "composer.hint":
    "Gõ /teach <câu trả lời> để dạy câu trả lời cho tin nhắn vừa rồi. Enter để gửi · Shift+Enter để xuống dòng.",
  "composer.send": "Gửi",
  "teach.prompt": "Mình nên trả lời là gì?",
  "teach.promptFor": "Mình nên trả lời {{ input }} là gì?",
  "teach.cancel": "Huỷ",
  "teach.submit": "Dạy",
  "system.learned": "đã học! lần sau mình sẽ nhớ.",
  "vote.up": "Thích",
  "vote.down": "Không thích",
  "localeSwitcher.label": "Ngôn ngữ",
  "empty.greeting": "Chào! Hỏi mình bất cứ điều gì.",
  "empty.hint":
    "Mình học từ những gì bạn dạy. Gõ /teach <câu trả lời> nếu mình chưa biết câu trả lời.",
  "scroll.toBottom": "Xuống dưới cùng",
  "error.chat": "Gửi tin nhắn thất bại — kiểm tra kết nối và thử lại.",
  "error.feedback": "Lưu đánh giá thất bại.",
  "notFound.title": "Lạc trong cuộc trò chuyện",
  "notFound.body": "Trang bạn tìm không tồn tại.",
  "notFound.back": "Quay lại chat",
  // Pool: caller picks one variant per no_match event. Keeps back-to-back
  // misses from repeating verbatim; mirrors the server matcher's top-K
  // random selection.
  "noMatch.fallback": [
    "hmm chưa biết, kể mình nghe thêm đi?",
    "ơ mình chưa biết cái này, dạy mình với?",
    "mình chưa hiểu lắm, nói rõ thêm xem nào?",
    "hmm, cái này lạ thật — kể tiếp đi?",
    "ủa mình chịu rồi, dạy mình đi mà?",
  ],
};
