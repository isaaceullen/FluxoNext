import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.post("/api/parse-transaction", upload.single("image"), async (req, res) => {
    try {
      const { text, history, categories, cards, today } = req.body;
      const parsedHistory = history ? JSON.parse(history) : [];
      const parsedCategories = categories ? JSON.parse(categories) : [];
      const parsedCards = cards ? JSON.parse(cards) : [];
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3.1-flash-lite-preview";

      let prompt = `
        Você é um assistente financeiro especialista em leitura de recibos e extratos bancários brasileiros. Extraia com precisão cirúrgica o valor, o estabelecimento, a data e a forma de pagamento/cartão de prints de tela ou fotos de comprovantes. Retorne os dados estritamente em formato estruturado.
        Hoje é ${today || new Date().toISOString()}.
        Use o histórico de mensagens para entender se o usuário está enviando um NOVO gasto ou CORRIGINDO o anterior (ex: 'mude o valor para 50').
        
        Categorias Disponíveis: ${parsedCategories.join(', ')}.
        Cartões Disponíveis: ${parsedCards.join(', ')}.
        
        REGRAS: 
        - Se não tiver certeza da categoria ou cartão, retorne null no JSON.
        - Se o usuário citar apenas o mês (ex: 'Junho'), use o ano atual.
        - REGRA DA FATURA (billingMonth): O mês da fatura DEVE ser SEMPRE o mês SEGUINTE ao da data da compra (purchaseDate). Exemplo: se a compra foi em Fevereiro, a fatura é em Março.
        - PARCELAMENTO: Aja de forma lógica. Sempre retorne o 'value' como o VALOR TOTAL.
        
        Retorne EXCLUSIVAMENTE um JSON (Array se houver múltiplos itens, ou um único objeto) com este formato:
        [
          {
            "name": "Nome curto do gasto (Estabelecimento ou Produto)",
            "value": Valor TOTAL numérico (ex: 50.00),
            "category": "Nome da categoria inferida ou null",
            "paymentMethod": "Nome do cartão, 'Dinheiro', ou null",
            "purchaseDate": "YYYY-MM-DD",
            "billingMonth": "YYYY-MM",
            "isInstallment": true ou false,
            "installments": número de parcelas (padrão 1)
          }
        ]

        Histórico da conversa:
        ${parsedHistory.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
      `;

      if (text && text.trim()) {
        prompt += `\nNova mensagem do usuário: "${text}"`;
      }

      const contents: any[] = [];
      if (req.file) {
        contents.push({
          inlineData: {
            data: req.file.buffer.toString("base64"),
            mimeType: req.file.mimetype,
          }
        });
        prompt += `\n\nAnalise a imagem enviada (recibo, comprovante, extrato bancário). Extraia todos os gastos identificados. Se houver vários itens em um extrato, retorne-os como um array de objetos JSON. Extraia o estabelecimento (name), o valor (value), data (purchaseDate), cartão/forma de pagamento (se visível).`;
      }
      
      contents.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: {
          responseMimeType: "application/json"
        }
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("No response from AI");

      let parsedData = JSON.parse(jsonText);
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }

      res.json(parsedData);
    } catch (error) {
      console.error("AI Parse Error:", error);
      res.status(500).json([{ error: "Failed to parse transaction" }]);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
