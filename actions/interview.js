"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
  }
});

// Helper function to extract and parse JSON from AI response
function extractJSON(text) {
  try {
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to find JSON object in the text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    // Parse JSON
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (e) {
    console.error("JSON parsing failed. Raw text:", text);
    console.error("Cleaned text:", text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    throw new Error(`Failed to parse JSON: ${e.message}`);
  }
}

export async function generateQuiz() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      industry: true,
      skills: true,
    },
  });

  if (!user) throw new Error("User not found");

  const prompt = `You are an expert technical interviewer. Generate 10 technical interview questions for a ${
    user.industry
  } professional${
    user.skills?.length ? ` with expertise in ${user.skills.join(", ")}` : ""
  }.

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON, absolutely no other text before or after
2. Do NOT wrap in markdown code blocks
3. Each question must have exactly 4 options
4. correctAnswer must be one of the 4 options (exact match)

Required JSON format:
{
  "questions": [
    {
      "question": "What is the primary purpose of React hooks?",
      "options": ["State management", "DOM manipulation", "API calls", "Routing"],
      "correctAnswer": "State management",
      "explanation": "React hooks primarily enable state management and side effects in functional components."
    }
  ]
}

Generate 10 questions now in valid JSON format only:`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    console.log("=== RAW AI RESPONSE ===");
    console.log(responseText);
    console.log("=== END RAW RESPONSE ===");
    
    // Extract and parse JSON
    const quiz = extractJSON(responseText);
    
    // Validate structure
    if (!quiz.questions || !Array.isArray(quiz.questions)) {
      throw new Error("Invalid response: missing questions array");
    }
    
    if (quiz.questions.length === 0) {
      throw new Error("No questions generated");
    }
    
    // Validate each question
    quiz.questions.forEach((q, index) => {
      if (!q.question || typeof q.question !== 'string') {
        throw new Error(`Question ${index + 1}: missing or invalid question text`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Question ${index + 1}: must have exactly 4 options`);
      }
      if (!q.correctAnswer || typeof q.correctAnswer !== 'string') {
        throw new Error(`Question ${index + 1}: missing or invalid correctAnswer`);
      }
      if (!q.options.includes(q.correctAnswer)) {
        throw new Error(`Question ${index + 1}: correctAnswer "${q.correctAnswer}" not found in options`);
      }
      if (!q.explanation || typeof q.explanation !== 'string') {
        throw new Error(`Question ${index + 1}: missing explanation`);
      }
    });

    return quiz.questions;
  } catch (error) {
    console.error("Error generating quiz:", error);
    console.error("Error details:", error.message);
    throw new Error(`Failed to generate quiz questions: ${error.message}`);
  }
}

export async function saveQuizResult(questions, answers, score) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      industry: true,
    },
  });

  if (!user) throw new Error("User not found");

  const questionResults = questions.map((q, index) => ({
    question: q.question,
    answer: q.correctAnswer,
    userAnswer: answers[index],
    isCorrect: q.correctAnswer === answers[index],
    explanation: q.explanation,
  }));

  // Get wrong answers
  const wrongAnswers = questionResults.filter((q) => !q.isCorrect);

  // Only generate improvement tips if there are wrong answers
  let improvementTip = null;
  if (wrongAnswers.length > 0) {
    const wrongQuestionsText = wrongAnswers
      .map(
        (q) =>
          `Question: "${q.question}"\nCorrect Answer: "${q.answer}"\nUser Answer: "${q.userAnswer}"`
      )
      .join("\n\n");

    const improvementPrompt = `The user got the following ${user.industry} technical interview questions wrong:

${wrongQuestionsText}

Based on these mistakes, provide a concise, specific improvement tip.
Focus on the knowledge gaps revealed by these wrong answers.
Keep the response under 2 sentences and make it encouraging.
Don't explicitly mention the mistakes, instead focus on what to learn/practice.

Return only the improvement tip text, no extra formatting:`;

    try {
      const tipResult = await model.generateContent(improvementPrompt);
      improvementTip = tipResult.response.text().trim();
      console.log("Improvement tip:", improvementTip);
    } catch (error) {
      console.error("Error generating improvement tip:", error);
      // Continue without improvement tip if generation fails
      improvementTip = "Keep practicing to improve your skills!";
    }
  }

  try {
    const assessment = await db.assessment.create({
      data: {
        userId: user.id,
        quizScore: score,
        questions: questionResults,
        category: "Technical",
        improvementTip,
      },
    });

    return assessment;
  } catch (error) {
    console.error("Error saving quiz result:", error);
    throw new Error("Failed to save quiz result");
  }
}

export async function getAssessments() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
    },
  });

  if (!user) throw new Error("User not found");

  try {
    const assessments = await db.assessment.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc", // Changed to desc for most recent first
      },
    });

    return assessments;
  } catch (error) {
    console.error("Error fetching assessments:", error);
    throw new Error("Failed to fetch assessments");
  }
}