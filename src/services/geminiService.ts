import { GoogleGenAI } from "@google/genai";
import { ExtractedData } from "../types";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const parseTransactionText = async (
  text: string, 
  history: { role: 'user' | 'ai'; content: string }[] = [],
  categories: string[] = [],
  cards: string[] = [],
  today: string = new Date().toISOString()
): Promise<ExtractedData> => {
  try {
    const model = "gemini-3-flash-preview";
    
    const prompt = `
      Você é o assistente financeiro do FluxoNext. Hoje é ${today}.
      Use o histórico de mensagens para entender se o usuário está enviando um NOVO gasto ou CORRIGINDO o anterior (ex: 'mude o valor para 50').
      
      Categorias Disponíveis: ${categories.join(', ')}.
      Cartões Disponíveis: ${cards.join(', ')}.
      
      REGRAS: 
      - Se não tiver certeza da categoria ou cartão, retorne null no JSON.
      - Se o usuário citar apenas o mês (ex: 'Junho'), use o ano atual de ${today}.
      - REGRA DA FATURA (billingMonth): O mês da fatura DEVE ser SEMPRE o mês SEGUINTE ao da data da compra (purchaseDate). Exemplo: se a compra foi em Fevereiro, a fatura é em Março. Aplique essa regra matematicamente em todos os casos, a menos que o usuário exija explicitamente um mês de fatura diferente.
      - PARCELAMENTO: Aja de forma lógica. Se o usuário disser "1000 em 10x", o valor total é 1000 e parcelas é 10. Se ele disser "10x de 150", o valor total é 1500 e parcelas é 10. Sempre retorne o 'value' como o VALOR TOTAL.
      
      Retorne EXCLUSIVAMENTE um JSON com este formato:
      {
        "name": "Nome curto do gasto",
        "value": Valor TOTAL numérico (ex: 50.00),
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