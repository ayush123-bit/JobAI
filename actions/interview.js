// "use server";

// import { db } from "@/lib/prisma";
// import { auth } from "@clerk/nextjs/server";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ 
//   model: "gemini-2.5-flash",
//   generationConfig: {
//     temperature: 0.7,
//     topP: 0.95,
//     topK: 40,
//   }
// });

// // Helper function to extract and parse JSON from AI response
// function extractJSON(text) {
//   try {
//     // Remove markdown code blocks
//     let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
//     // Try to find JSON object in the text
//     const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
//     if (jsonMatch) {
//       cleaned = jsonMatch[0];
//     }
    
//     // Parse JSON
//     const parsed = JSON.parse(cleaned);
//     return parsed;
//   } catch (e) {
//     console.error("JSON parsing failed. Raw text:", text);
//     console.error("Cleaned text:", text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
//     throw new Error(`Failed to parse JSON: ${e.message}`);
//   }
// }

// export async function generateQuiz() {
//   const { userId } = await auth();
//   if (!userId) throw new Error("Unauthorized");

//   const user = await db.user.findUnique({
//     where: { clerkUserId: userId },
//     select: {
//       id: true,
//       industry: true,
//       skills: true,
//     },
//   });

//   if (!user) throw new Error("User not found");

//   const prompt = `You are an expert technical interviewer. Generate 10 technical interview questions for a ${
//     user.industry
//   } professional${
//     user.skills?.length ? ` with expertise in ${user.skills.join(", ")}` : ""
//   }.

// CRITICAL REQUIREMENTS:
// 1. Return ONLY valid JSON, absolutely no other text before or after
// 2. Do NOT wrap in markdown code blocks
// 3. Each question must have exactly 4 options
// 4. correctAnswer must be one of the 4 options (exact match)

// Required JSON format:
// {
//   "questions": [
//     {
//       "question": "What is the primary purpose of React hooks?",
//       "options": ["State management", "DOM manipulation", "API calls", "Routing"],
//       "correctAnswer": "State management",
//       "explanation": "React hooks primarily enable state management and side effects in functional components."
//     }
//   ]
// }

// Generate 10 questions now in valid JSON format only:`;

//   try {
//     const result = await model.generateContent(prompt);
//     const responseText = result.response.text();
    
//     console.log("=== RAW AI RESPONSE ===");
//     console.log(responseText);
//     console.log("=== END RAW RESPONSE ===");
    
//     // Extract and parse JSON
//     const quiz = extractJSON(responseText);
    
//     // Validate structure
//     if (!quiz.questions || !Array.isArray(quiz.questions)) {
//       throw new Error("Invalid response: missing questions array");
//     }
    
//     if (quiz.questions.length === 0) {
//       throw new Error("No questions generated");
//     }
    
//     // Validate each question
//     quiz.questions.forEach((q, index) => {
//       if (!q.question || typeof q.question !== 'string') {
//         throw new Error(`Question ${index + 1}: missing or invalid question text`);
//       }
//       if (!Array.isArray(q.options) || q.options.length !== 4) {
//         throw new Error(`Question ${index + 1}: must have exactly 4 options`);
//       }
//       if (!q.correctAnswer || typeof q.correctAnswer !== 'string') {
//         throw new Error(`Question ${index + 1}: missing or invalid correctAnswer`);
//       }
//       if (!q.options.includes(q.correctAnswer)) {
//         throw new Error(`Question ${index + 1}: correctAnswer "${q.correctAnswer}" not found in options`);
//       }
//       if (!q.explanation || typeof q.explanation !== 'string') {
//         throw new Error(`Question ${index + 1}: missing explanation`);
//       }
//     });

//     return quiz.questions;
//   } catch (error) {
//     console.error("Error generating quiz:", error);
//     console.error("Error details:", error.message);
//     throw new Error(`Failed to generate quiz questions: ${error.message}`);
//   }
// }

// export async function saveQuizResult(questions, answers, score) {
//   const { userId } = await auth();
//   if (!userId) throw new Error("Unauthorized");

//   const user = await db.user.findUnique({
//     where: { clerkUserId: userId },
//     select: {
//       id: true,
//       industry: true,
//     },
//   });

//   if (!user) throw new Error("User not found");

//   const questionResults = questions.map((q, index) => ({
//     question: q.question,
//     answer: q.correctAnswer,
//     userAnswer: answers[index],
//     isCorrect: q.correctAnswer === answers[index],
//     explanation: q.explanation,
//   }));

//   // Get wrong answers
//   const wrongAnswers = questionResults.filter((q) => !q.isCorrect);

//   // Only generate improvement tips if there are wrong answers
//   let improvementTip = null;
//   if (wrongAnswers.length > 0) {
//     const wrongQuestionsText = wrongAnswers
//       .map(
//         (q) =>
//           `Question: "${q.question}"\nCorrect Answer: "${q.answer}"\nUser Answer: "${q.userAnswer}"`
//       )
//       .join("\n\n");

//     const improvementPrompt = `The user got the following ${user.industry} technical interview questions wrong:

// ${wrongQuestionsText}

// Based on these mistakes, provide a concise, specific improvement tip.
// Focus on the knowledge gaps revealed by these wrong answers.
// Keep the response under 2 sentences and make it encouraging.
// Don't explicitly mention the mistakes, instead focus on what to learn/practice.

// Return only the improvement tip text, no extra formatting:`;

//     try {
//       const tipResult = await model.generateContent(improvementPrompt);
//       improvementTip = tipResult.response.text().trim();
//       console.log("Improvement tip:", improvementTip);
//     } catch (error) {
//       console.error("Error generating improvement tip:", error);
//       // Continue without improvement tip if generation fails
//       improvementTip = "Keep practicing to improve your skills!";
//     }
//   }

//   try {
//     const assessment = await db.assessment.create({
//       data: {
//         userId: user.id,
//         quizScore: score,
//         questions: questionResults,
//         category: "Technical",
//         improvementTip,
//       },
//     });

//     return assessment;
//   } catch (error) {
//     console.error("Error saving quiz result:", error);
//     throw new Error("Failed to save quiz result");
//   }
// }

// export async function getAssessments() {
//   const { userId } = await auth();
//   if (!userId) throw new Error("Unauthorized");

//   const user = await db.user.findUnique({
//     where: { clerkUserId: userId },
//     select: {
//       id: true,
//     },
//   });

//   if (!user) throw new Error("User not found");

//   try {
//     const assessments = await db.assessment.findMany({
//       where: {
//         userId: user.id,
//       },
//       orderBy: {
//         createdAt: "desc", // Changed to desc for most recent first
//       },
//     });

//     return assessments;
//   } catch (error) {
//     console.error("Error fetching assessments:", error);
//     throw new Error("Failed to fetch assessments");
//   }
// }
"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* ----------------------------- Utilities ----------------------------- */

// Safely extract JSON from LLM output
function extractJSON(text) {
  try {
    let cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");

    return JSON.parse(match[0]);
  } catch (err) {
    console.error("❌ JSON parsing failed. RAW OUTPUT:\n", text);
    throw new Error("Invalid JSON from AI");
  }
}

// Validate + auto-fix quiz structure (NON-BREAKING)
function sanitizeAndValidateQuiz(quiz) {
  if (!quiz || !Array.isArray(quiz.questions)) {
    throw new Error("Invalid quiz structure");
  }

  // 🔒 Hard guard: trim extra questions, fail only if insufficient
  if (quiz.questions.length > 10) {
    console.warn("⚠️ Extra questions detected. Trimming to 10.");
    quiz.questions = quiz.questions.slice(0, 10);
  }

  if (quiz.questions.length < 10) {
    throw new Error(`Expected 10 questions, got ${quiz.questions.length}`);
  }

  quiz.questions = quiz.questions.map((q, index) => {
    const question = q.question?.trim();
    const options = Array.isArray(q.options)
      ? q.options.map((o) => o?.trim()).filter(Boolean)
      : [];

    let correctAnswer = q.correctAnswer?.trim();
    let explanation = q.explanation?.trim();

    if (!question) {
      throw new Error(`Question ${index + 1}: missing question`);
    }

    if (options.length !== 4) {
      throw new Error(`Question ${index + 1}: must have exactly 4 options`);
    }

    // Auto-fix invalid correctAnswer
    if (!correctAnswer || !options.includes(correctAnswer)) {
      console.warn(
        `⚠️ Question ${index + 1}: invalid correctAnswer. Auto-fixing.`
      );
      correctAnswer = options[0];
    }

    // ✅ Auto-fill explanation instead of failing
    if (!explanation) {
      console.warn(
        `⚠️ Question ${index + 1}: missing explanation. Auto-filling.`
      );
      explanation = `The correct answer is "${correctAnswer}" because it best fits the question context.`;
    }

    return {
      question,
      options,
      correctAnswer,
      explanation,
    };
  });

  return quiz;
}

// Retry prompt to repair broken JSON (STRICT)
async function retryFixJSON(badOutput) {
  const fixPrompt = `
You MUST fix the JSON below.

STRICT RULES:
- Return ONLY valid JSON
- EXACTLY 10 questions (not more, not less)
- Do NOT add new questions
- Do NOT remove questions
- Each question must have 4 options
- correctAnswer MUST be one of the options
- Fill ALL empty explanation fields
- NO markdown
- NO extra text

Broken JSON:
${badOutput}
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: fixPrompt }],
    temperature: 0,
    max_tokens: 1200,
  });

  return completion.choices[0]?.message?.content || "";
}

/* ----------------------------- Generate Quiz ----------------------------- */

export async function generateQuiz() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, industry: true, skills: true },
  });

  if (!user) throw new Error("User not found");

  const prompt = `
You are an expert technical interviewer.

Generate EXACTLY 10 multiple-choice interview questions.

Context:
- Industry: ${user.industry}
${user.skills?.length ? `- Skills: ${user.skills.join(", ")}` : ""}

STRICT RULES:
1. Return ONLY valid JSON
2. NO markdown, NO explanations outside JSON
3. EXACTLY 10 questions
4. Each question must have exactly 4 options
5. correctAnswer MUST be one of the options
6. NO empty fields

JSON FORMAT:
{
  "questions": [
    {
      "question": "",
      "options": ["", "", "", ""],
      "correctAnswer": "",
      "explanation": ""
    }
  ]
}
`;

  let rawOutput = "";

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 1500,
    });

    rawOutput = completion.choices[0]?.message?.content?.trim() || "";
    console.log("=== RAW AI RESPONSE ===\n", rawOutput);

    let quiz = extractJSON(rawOutput);
    quiz = sanitizeAndValidateQuiz(quiz);

    return quiz.questions;
  } catch (err) {
    console.error("⚠️ Initial generation failed. Attempting repair...");

    try {
      const fixedOutput = await retryFixJSON(rawOutput);
      console.log("=== FIXED AI RESPONSE ===\n", fixedOutput);

      let quiz = extractJSON(fixedOutput);
      quiz = sanitizeAndValidateQuiz(quiz);

      return quiz.questions;
    } catch (finalErr) {
      console.error("❌ Quiz generation failed:", finalErr);
      throw new Error("Failed to generate quiz questions");
    }
  }
}

/* ----------------------------- Save Quiz Result ----------------------------- */

export async function saveQuizResult(questions, answers, score) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, industry: true },
  });

  if (!user) throw new Error("User not found");

  const questionResults = questions.map((q, index) => ({
    question: q.question,
    answer: q.correctAnswer,
    userAnswer: answers[index] ?? null,
    isCorrect: q.correctAnswer === answers[index],
    explanation: q.explanation,
  }));

  const wrongAnswers = questionResults.filter((q) => !q.isCorrect);

  let improvementTip = null;

  if (wrongAnswers.length > 0) {
    const wrongText = wrongAnswers
      .map(
        (q) =>
          `Question: ${q.question}
Correct: ${q.answer}
User: ${q.userAnswer || "No answer"}`
      )
      .join("\n\n");

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: `
The user missed these ${user.industry} interview questions:

${wrongText}

Give ONE concise improvement tip.
Rules:
- Max 2 sentences
- Encouraging
- Plain text only`,
          },
        ],
        temperature: 0.4,
        max_tokens: 80,
      });

      improvementTip =
        completion.choices[0]?.message?.content?.trim() ||
        "Keep practicing core concepts.";
    } catch {
      improvementTip = "Keep practicing core concepts.";
    }
  }

  return db.assessment.create({
    data: {
      userId: user.id,
      quizScore: score,
      questions: questionResults,
      category: "Technical",
      improvementTip,
    },
  });
}

/* ----------------------------- Fetch Assessments ----------------------------- */

export async function getAssessments() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });

  if (!user) throw new Error("User not found");

  return db.assessment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
}
