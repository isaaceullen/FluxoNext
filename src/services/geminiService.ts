import { GoogleGenAI } from "@google/genai";
import { ExtractedData } from "../types";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const parseTransactionText = async (
  text: string, 
  history: any[] = [],
  categories: string[] = [],
  cards: string[] = [],
  today: string = new Date().toISOString()
): Promise<ExtractedData> => {
  try {
    const model = "gemini-3-flash-preview";
    
    // Filtra o histórico para enviar apenas texto útil para a IA
    const cleanHistory = history
      .filter(m => typeof m.content === 'string')
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');
    
    const prompt = `
      Você é o assistente financeiro do FluxoNext. Hoje é ${today}.
      Use o histórico de mensagens para entender se o usuário está enviando um NOVO gasto ou CORRIGINDO o anterior (ex: 'mude o valor para 50').
      
      Categorias Disponíveis: ${categories.join(', ')}.
      Cartões Disponíveis: ${cards.join(', ')}.
      
      REGRAS: 
      - Se não tiver certeza da categoria ou cartão, retorne null.
      - Se o usuário citar apenas o mês (ex: 'Junho'), use o ano atual de ${today}, a menos que ele especifique outro.
      - PARCELAMENTO: Aja de forma lógica. Se o usuário disser "1000 em 10x", o valor total é 1000 e parcelas é 10. Se ele disser "10x de 150", o valor total é 1500 e parcelas é 10. Sempre retorne o 'value' como o VALOR TOTAL.
      
      Retorne EXCLUSIVAMENTE um JSON com este formato exato:
      {
        "name": "Nome curto do gasto",
        "value": Valor TOTAL numérico (ex: 1500.00),
        "category": "Nome exato da categoria ou null",
        "paymentMethod": "Nome exato do cartão ou 'Dinheiro' ou null",
        "purchaseDate": "YYYY-MM-DD",
        "billingMonth": "YYYY-MM",
        "isInstallment": true ou false,
        "installments": número de parcelas (padrão 1)
      }

      Histórico da conversa:
      ${cleanHistory}
      
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