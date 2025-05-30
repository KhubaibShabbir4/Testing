import axios from "axios";

// Fetch API key from environment variables
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined in environment variables.");
}

// Define Gemini API endpoint
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

/**
 * Main function to fetch response from the Gemini API.
 * - Enforces a 100-word limit by truncating extra words in the user's input.
 * - Logs the API response for debugging.
 * - Returns the raw text response from the model.
 */
export const fetchGeminiResponse = async (userMessage) => {
  // 1) Enforce 100-word limit
  let words = userMessage.trim().split(/\s+/);
  if (words.length > 100) {
    words = words.slice(0, 100);
    userMessage = words.join(" ");
  }

  try {
    const response = await axios.post(
      API_URL,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        systemInstruction: {
          role: "user",
          parts: [
            {
              text: `You are an expert medical advisor providing accurate healthcare information and guidance. 
                    1. Only answer questions strictly related to medical topics, including diseases, treatments, medications, symptoms, medical research, and general health advice.  
                    2. If a question is unrelated to medical topics, politely decline to answer and explain that you can only provide healthcare-related information.  
                    3. RESPIND ONLY IN ENGLISH. If a question is asked in another language, request that the user ask in English.  
                    4. Do not provide personal medical diagnoses. Instead, advise users to consult a qualified healthcare professional for personalized medical concerns.  
                    5. Ensure all responses are based on medically accepted guidelines and avoid spreading misinformation. If uncertain, recommend consulting a healthcare professional.  
                    4. Do not provide legal, financial, or non-medical advice. Politely decline such requests.`,
            },
          ],
        },
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Gemini API Response:", response.data);

    // Extract and return the raw text response without any formatting
    return (
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I couldn't understand that."
    );
  } catch (error) {
    console.error(
      "Error fetching response from Gemini API:",
      error.response?.data || error.message
    );
    return "Sorry, there was an error processing your request.";
  }
};

/**
 * Format the API response to ensure clean, readable text.
 * 1. Normalizes line endings
 * 2. Converts double underscores (__) & double asterisks (**) to bold
 * 3. Converts single asterisks (*text*) to italics if they appear in a matched pair
 * 4. Places bullet points on separate lines
 * 5. Cleans up extra blank lines, trailing spaces, etc.
 */
const formatResponse = (text) => {
  if (!text) return "No response available.";

  let formattedText = text.trim();

  // 1. Normalize line endings (Windows -> Unix)
  formattedText = formattedText.replace(/\r\n/g, "\n");

  // 2. Remove trailing spaces at the end of each line
  formattedText = formattedText.replace(/[ \t]+$/gm, "");

  // 3. Replace multiple consecutive blank lines with a single blank line
  formattedText = formattedText.replace(/\n\s*\n\s*\n+/g, "\n\n");

  // 4. Convert double underscores (e.g. __Heading__) to bold markers
  //    We'll treat them similarly to **bold** by inserting special markers
  formattedText = formattedText.replace(
    /__([^_]+)__/g, // looks for pairs of __ __
    "\n🔹 $1 🔹" // same style as **bold**
  );

  // 5. Format bold text (**text**) as 🔹 text 🔹
  formattedText = formattedText.replace(
    /\*\*(.*?)\*\*/g, // looks for pairs of ** **
    "\n🔹 $1 🔹"
  );

  // 6. Format italic text (*text*) as _text_
  //    - Only if we find a matching pair of single asterisks
  formattedText = formattedText.replace(
    /\*(.*?)\*/g, // looks for pairs of * *
    (match, p1) => {
      // If p1 contains another '*', skip to avoid messing up bullet points
      if (p1.includes("*")) return match;
      return `_${p1}_`;
    }
  );

  // 7. Ensure each bullet point (*, -, •, ♦) starts on its own line
  //    - If there's text before the bullet without a newline, add one
  formattedText = formattedText.replace(/([^\n])([•♦*\-])\s+/g, "$1\n$2 ");
  //    - If a bullet is already at the start of a line, just clean up spacing
  formattedText = formattedText.replace(/\n\s*([•♦*\-])\s+/g, "\n$1 ");

  // 8. Handle sub-bullets (indented bullets -> '◦')
  //    - If there's 2+ spaces before a bullet, we treat it as a sub-bullet
  formattedText = formattedText.replace(/\n\s{2,}([•♦*\-])\s+/g, "\n   ◦ ");

  // 9. Convert triple+ spaces to double spaces
  formattedText = formattedText.replace(/\s{3,}/g, "  ");

  // 10. Final trim to remove leading/trailing blank lines or spaces
  formattedText = formattedText.trim();

  return formattedText;
};
