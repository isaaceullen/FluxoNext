import { GoogleGenAI } from "@google/genai";
import { ExtractedData } from "../types";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const parseTransactionText = async (text: string, today: string = new Date().toISOString()): Promise<ExtractedData> => {
  try {
    const model = "gemini-3-flash-preview";
    
    const prompt = `
      Você é um extrator de dados financeiros. Sua única função é analisar o texto do usuário e retornar EXCLUSIVAMENTE um objeto JSON válido. Nunca adicione texto conversacional, saudações ou formatação markdown (\`\`\`json).
      O JSON deve ter EXATAMENTE este formato:
      {
        "name": "Nome curto do gasto (ex: Energetico)",
        "value": Valor numérico (ex: 50.00),
        "category": "Nome da categoria inferida",
        "paymentMethod": "Nome do cartão ou 'Dinheiro' mencionado",
        "isInstallment": true ou false,
        "installments": número de parcelas (se não mencionado, use 1)
      }
      Seja inteligente ao extrair: '50 reais' deve virar 50.00. 'Nubank' vai para paymentMethod.

      Texto do usuário: "${text}"
      Hoje é ${today}.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    return JSON.parse(jsonText) as ExtractedData;
  } catch (error) {
    console.error("AI Parse Error:", error);
    return {
      confidence: 0,
      missingFields: ["error"]
    };
  }
};

export const parseTransactionAudio = async (audioBase64: string, mimeType: string = "audio/webm"): Promise<ExtractedData> => {
  try {
    const model = "gemini-3-flash-preview";
    
    const prompt = `
      Analise este áudio e extraia os dados de despesa exatamente como você faz com texto. Retorne OBRIGATORIAMENTE o JSON estruturado com: { name, value, category, paymentMethod, isInstallment, installments }.
      Seja inteligente ao extrair: '50 reais' deve virar 50.00. 'Nubank' vai para paymentMethod.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    return JSON.parse(jsonText) as ExtractedData;
  } catch (error) {
    console.error("AI Audio Parse Error:", error);
    return {
      confidence: 0,
      missingFields: ["error"]
    };
  }
};
