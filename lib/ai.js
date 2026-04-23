const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateIcebreaker(visitor) {
  // Fallback to standard if no API key is provided
  if (!process.env.OPENAI_API_KEY) {
    return `Noticed you checked out our ${visitor.pagesVisited || "site"} page — we help ${visitor.company || "companies like yours"} build automated systems. Worth a quick chat?`;
  }

  try {
    const prompt = `
      You are a top-tier B2B sales SDR. Write a single, highly personalized 1-2 sentence icebreaker email opening.
      
      Context:
      Name: ${visitor.firstName}
      Title: ${visitor.title}
      Company: ${visitor.company}
      Page Visited: ${visitor.pagesVisited}
      
      Goal: Connect the fact that they visited our site to their role, showing you did your homework.
      Rules: Keep it casual, no corporate jargon, maximum 35 words. Do not use generic greetings like "Hi [Name]", just jump straight into the icebreaker line.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cheap
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI failed:", error.message);
    // Fallback on failure
    return `Noticed you checked out our ${visitor.pagesVisited || "site"} page — we help ${visitor.company || "companies like yours"} build automated systems. Worth a quick chat?`;
  }
}

module.exports = { generateIcebreaker };
