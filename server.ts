import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // Lazy Gemini client helper
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI | null {
    if (!process.env.GEMINI_API_KEY) {
      return null;
    }
    if (!aiClient) {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
  }

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // AI Desi Caption & Hashtag Generator
  app.post("/api/ai/caption", async (req, res) => {
    try {
      const { prompt, vibe, location, language, imageBase64 } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        // High quality fallback presets if no API key provided
        const fallbacks: Record<string, { caption: string; hashtags: string[]; shayari?: string }> = {
          bollywood: {
            caption: "Picture abhi baaki hai mere dost! ✨ Adding a little cinematic drama to an ordinary day.",
            hashtags: ["#BollywoodVibes", "#DesiSwag", "#FilmyLife", "#InstaBharat", "#HeroEntry"],
            shayari: "Zindagi ek haseen khwaab hai, bas jeene ka andaaz aana chahiye."
          },
          chai: {
            caption: "Ek cup adrak wali kadak chai aur sukoon bhari baatein. ☕ Nothing beats this feeling.",
            hashtags: ["#ChaiPeCharcha", "#KadakChai", "#Sukoon", "#DesiMornings", "#ChaiLoversIndia"],
            shayari: "Chai se ishq hai to phir aitbaar kaisa, har ghunt mein sukoon hai to intezaar kaisa."
          },
          festive: {
            caption: "Rang, roshni, aur apno ka pyaar. Celebrating the vibrant spirit of festivals! 🪔✨",
            hashtags: ["#DesiFestival", "#ShaadiSeason", "#JhumkaGiraRe", "#TraditionalLook", "#Utsav"],
            shayari: "Har tyohar ek umeed lekar aata hai, khushiyon ki mehak se aangan sajata hai."
          },
          travel: {
            caption: "Galiyon se ghats tak, Bharat ki har kone mein ek kahani hai. 🧭🇮🇳 Exploring the soul of India.",
            hashtags: ["#IncredibleIndia", "#DesiWanderlust", "#GhatsOfVaranasi", "#StreetsofIndia", "#BharatDarshan"]
          },
          sarcastic: {
            caption: "Log poochte hain itna attitude kahan se laate ho? Maine kaha 'Made in India' hai boss! 😎",
            hashtags: ["#DesiHumor", "#Bindaas", "#AttitudeStatus", "#NoFilterNeeded", "#DesiSwag"]
          }
        };

        const selected = fallbacks[vibe || "chai"] || fallbacks.chai;
        return res.json({
          caption: selected.caption,
          hashtags: selected.hashtags,
          shayari: selected.shayari,
          source: "curated_desi_preset"
        });
      }

      const systemInstruction = `You are a witty, culturally rich Indian Instagram Content Creator assistant. 
Generate engaging Instagram captions with authentic Indian cultural flavor (Hinglish/Hindi/English mix where appropriate). 
Format output in clean JSON with fields:
- "caption": Engaging caption (1-3 sentences with emojis like ✨, ☕, 🪔, 🇮🇳, 🌸)
- "shayari": An optional 2-line poetic couplet/sher in Roman Hindi or Urdu if requested or relevant to the vibe
- "hashtags": Array of 5-8 trending Indian and relevant hashtags (e.g., #ChaiPeCharcha, #DesiVibes, #IncredibleIndia)
- "altText": 1 sentence descriptive visual tag`;

      const contents: any[] = [];
      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        contents.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64
          }
        });
      }

      const userText = `Generate an Instagram caption for:
- Context/Topic: ${prompt || "A beautiful memory in India"}
- Desi Vibe/Mood: ${vibe || "Desi Swag & Warmth"}
- Location Tag: ${location || "India"}
- Preferred Language Style: ${language || "Hinglish (Hindi + English blend)"}
Return strictly JSON.`;

      contents.push(userText);

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json({
        caption: parsed.caption || "Living the desi dream with chai and good vibes. ✨",
        hashtags: parsed.hashtags || ["#DesiVibes", "#BharatClicks", "#InstaLite"],
        shayari: parsed.shayari || null,
        altText: parsed.altText || null,
        source: "gemini_ai"
      });
    } catch (err: any) {
      console.error("AI Caption error:", err);
      res.status(500).json({
        error: "Failed to generate AI caption",
        caption: "Cherishing simple moments with kadak chai and great company. ☕✨",
        hashtags: ["#DesiVibes", "#Sukoon", "#IndianMoments"]
      });
    }
  });

  // AI Desi Smart Comments Suggestions
  app.post("/api/ai/suggest-comments", async (req, res) => {
    try {
      const { postCaption, authorName } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        return res.json({
          suggestions: [
            "Kya baat hai! Kadak photo boss 🔥",
            "Ekdum Bollywood hero entry! ✨",
            "Sundar aur shandaar! 👏",
            "Chai pe kab bula rahe ho? ☕",
            "Waah waah, rab rakha! 🙏"
          ]
        });
      }

      const prompt = `Give 4-5 natural, friendly, Indian style Instagram comment suggestions (in Hinglish, like "Bhai ekdum kadak!", "Sundar picture!", "Zabardast click! 📸") for this post by ${authorName || "a friend"}: "${postCaption || "Great day"}". Return JSON array of strings: { "suggestions": string[] }`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json({ suggestions: parsed.suggestions || [] });
    } catch (err: any) {
      res.json({
        suggestions: [
          "Bohot badiya! 🔥",
          "Sundar click! ✨",
          "Kya baat hai bhai! 👏",
          "Next level swag! 😎"
        ]
      });
    }
  });

  // Vite development middleware vs production static serving
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Instagram Lite Bharat server running on http://localhost:${PORT}`);
  });
}

startServer();
