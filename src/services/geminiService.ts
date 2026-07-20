import { ExtractedData } from "../types";

export const parseTransactionText = async (
  text: string, 
  history: { role: 'user' | 'ai'; content: string }[] = [],
  categories: string[] = [],
  cards: string[] = [],
  today: string = new Date().toISOString(),
  imageFile?: File | null
): Promise<ExtractedData[]> => {
  try {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('history', JSON.stringify(history));
    formData.append('categories', JSON.stringify(categories));
    formData.append('cards', JSON.stringify(cards));
    formData.append('today', today);
    if (imageFile) {
      formData.append('image', imageFile);
    }

    const res = await fetch("/api/parse-transaction", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Failed to parse transaction");
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error("AI Parse Error:", error);
    return [{
      confidence: 0,
      missingFields: ["error"]
    }];
  }
};