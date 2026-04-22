const logger = require("../utils/logger");

const FALLBACK_ANSWER = "Looking forward to discussing this in detail.";

function compactText(s, max = 24000) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

async function callOpenAIChatCompletions({ apiKey, baseUrl, model, messages }) {
  const url = `${String(baseUrl || "https://api.openai.com").replace(/\/+$/, "")}/v1/chat/completions`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 220,
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `OpenAI error ${resp.status}`;
    throw new Error(msg);
  }

  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : "";
}

/**
 * POST /api/ai/generate-answer
 * Body: { question, resumeText, jobTitle, companyName, jobDescription }
 */
async function generateAnswer(req, res) {
  const question = compactText(req.body?.question, 2000);
  const resumeText = compactText(req.body?.resumeText, 24000);
  const jobTitle = compactText(req.body?.jobTitle, 200);
  const companyName = compactText(req.body?.companyName, 200);
  const jobDescription = compactText(req.body?.jobDescription, 8000);

  if (!question) {
    return res.status(400).json({
      success: false,
      message: "question is required",
    });
  }

  const provider = String(process.env.AI_PROVIDER || "openai").toLowerCase();

  try {
    // Only one provider for now; keep API stable for extension.
    if (provider !== "openai") {
      return res.status(501).json({
        success: false,
        message: `AI provider not supported: ${provider}`,
        answer: FALLBACK_ANSWER,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(501).json({
        success: false,
        message: "OPENAI_API_KEY not configured",
        answer: FALLBACK_ANSWER,
      });
    }

    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com";
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const system = [
      "You are helping a candidate answer a job application question.",
      "Write a concise, professional answer in first person.",
      "Be truthful: only use information from the resume text.",
      "If the resume text doesn't contain relevant info, respond with a short neutral answer that doesn't invent details.",
      "Keep it under 900 characters unless the question clearly asks for more detail.",
    ].join(" ");

    const user = [
      `Question: ${question}`,
      jobTitle || companyName
        ? `Job context: ${jobTitle || "Role"} at ${companyName || "Company"}`
        : "",
      jobDescription ? `Job description (excerpt): ${jobDescription}` : "",
      resumeText ? `Resume text:\n${resumeText}` : "Resume text: (not provided)",
    ]
      .filter(Boolean)
      .join("\n\n");

    const answerRaw = await callOpenAIChatCompletions({
      apiKey,
      baseUrl,
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const answer = answerRaw || FALLBACK_ANSWER;

    return res.status(200).json({
      success: true,
      answer,
    });
  } catch (e) {
    logger.error("AI generate-answer failed", e);
    return res.status(200).json({
      success: false,
      answer: FALLBACK_ANSWER,
      message: e?.message || "AI failed",
    });
  }
}

module.exports = { generateAnswer };

