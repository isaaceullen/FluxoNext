import { GoogleGenAI } from "@google/genai";
import { ExtractedData } from "../types";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const parseTransactionText = async (
  text: string, 
  history: { role: 'user' | 'ai'; content: string }[] = [],
  categories: string[] = [],
  today: string = new Date().toISOString()
): Promise<ExtractedData> => {
  try {
    const model = "gemini-3-flash-preview";
    const currentYear = new Date().getFullYear();
    
    const prompt = `
      Você é um tutor financeiro do app FluxoNext. Hoje é ${today}.
      Ao receber uma mensagem, analise o histórico para entender se é um novo gasto ou uma CORREÇÃO do gasto anterior.
      
      Regra de Ano: Se o usuário disser apenas o mês (ex: 'Junho'), use o ano atual (${currentYear}), a menos que ele especifique o ano.
      Regra de Categorias: Use APENAS as categorias reais do usuário: [${categories.join(', ')}]. Se não tiver certeza, retorne 'category': null.
      
      Retorne EXCLUSIVAMENTE um JSON com este formato:
      {
        "name": "Nome curto do gasto",
        "value": Valor numérico (ex: 50.00),
        "category": "Nome da categoria inferida ou null",
        "paymentMethod": "Nome do cartão ou 'Dinheiro'",
        "purchaseDate": "YYYY-MM-DD",
        "billingMonth": "YYYY-MM",
        "isInstallment": true ou false,
        "installments": número de parcelas (padrão 1)
      }

      Histórico da conversa:
      ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
      
      Nova mensagem do usuário: "${text}"
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
