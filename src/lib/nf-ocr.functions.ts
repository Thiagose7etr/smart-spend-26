import { createServerFn } from "@tanstack/react-start";

type OcrInput = {
  imageBase64: string; // data URL or raw base64
  mimeType: string;
};

export type NfExtraida = {
  nf: string | null;
  fornecedor: string | null;
  data_emissao: string | null; // YYYY-MM-DD
  item: string | null;
  quant: number | null;
  valor_unit: number | null;
  valor_total: number | null;
  tipo: string | null;
};

const CATEGORIAS = [
  "COMBUSTIVEL","PEÇAS","SERVIÇO TERCEIRO","MAN E REPARO BENS","LUBRIFICANTES",
  "UNIFORMES/EPI","EQUIPAMENTOS","BORRACHARIA","INSUMOS","PINTURA","LAVADOR",
  "GUINCHO","LOCAÇÃO","PREDIAL SERV","PREDIAL MERC","LIMPEZA","ESCRITORIO",
  "HOSPEDAGEM","INFORMATICA","PRESIDENCIA","DIRETORIA","GRAFICA","FUNILARIA EXT",
  "GAS EMPILHADEIRA","DEDETIZAÇÃO",
];

export const extrairNotaFiscal = createServerFn({ method: "POST" })
  .inputValidator((data: OcrInput) => {
    if (!data?.imageBase64 || !data?.mimeType) throw new Error("Imagem inválida");
    return data;
  })
  .handler(async ({ data }): Promise<NfExtraida> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const raw = data.imageBase64.includes(",")
      ? data.imageBase64.split(",")[1]
      : data.imageBase64;
    const dataUrl = `data:${data.mimeType};base64,${raw}`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Você é um extrator de dados de Notas Fiscais brasileiras (NF-e/DANFE/cupom). Retorne SEMPRE apenas o JSON solicitado, com valores numéricos usando ponto decimal.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Leia esta nota fiscal e extraia os dados principais. Some todos os itens no valor_total. " +
                "Para 'item', descreva de forma curta o(s) produto(s)/serviço(s) principais. " +
                "Escolha o 'tipo' a partir desta lista fixa (o mais adequado): " +
                CATEGORIAS.join(", ") +
                ". Datas no formato AAAA-MM-DD. Use null quando não encontrar.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "registrar_nota_fiscal",
            description: "Registra os campos extraídos da nota fiscal",
            parameters: {
              type: "object",
              properties: {
                nf: { type: ["string", "null"], description: "Número da NF" },
                fornecedor: { type: ["string", "null"] },
                data_emissao: { type: ["string", "null"], description: "YYYY-MM-DD" },
                item: { type: ["string", "null"] },
                quant: { type: ["number", "null"] },
                valor_unit: { type: ["number", "null"] },
                valor_total: { type: ["number", "null"] },
                tipo: { type: ["string", "null"], enum: [...CATEGORIAS, null] },
              },
              required: ["nf", "fornecedor", "data_emissao", "item", "quant", "valor_unit", "valor_total", "tipo"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "registrar_nota_fiscal" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`Falha ao ler NF (${res.status}): ${txt.slice(0, 200)}`);
    }

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = call?.function?.arguments;
    if (!argsRaw) throw new Error("A IA não conseguiu extrair dados da imagem.");
    let parsed: NfExtraida;
    try {
      parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    } catch {
      throw new Error("Resposta da IA em formato inválido.");
    }
    return parsed;
  });