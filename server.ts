import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// REST API for ClaudeBridge Migration
app.post("/api/migrate/analyze", async (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ success: false, error: "Se requiere el código para analizar." });
  }

  if (!ai) {
    return res.status(500).json({
      success: false,
      error: "La clave API de Gemini no está configurada. Por favor configúrala en Settings > Secrets en AI Studio."
    });
  }

  try {
    const prompt = `Analiza y refactoriza el siguiente código de una aplicación o Artifact de Claude para que funcione perfectamente en nuestro entorno React 19 con Tailwind CSS v4, Vite y TypeScript.

Reglas para la refactorización:
1. Retorna el código fuente de un componente de React completo y válido.
2. Debe exportar por defecto un componente React principal (por ejemplo: "export default function ImportedApp()").
3. Si el código fuente original es HTML estático con CSS o JS inline, conviértelo a un componente de React con Tailwind CSS de manera elegante.
4. Asegúrate de que todas las importaciones de iconos sean desde 'lucide-react' (ejemplo: import { Activity, Zap, Check } from 'lucide-react';). No utilices SVG crudos ni librerías obsoletas si lucide tiene alternativas directas.
5. Usa Tailwind CSS para todos los estilos. Si el código usa clases personalizadas o estilos inline de CSS, conviértelos a clases utilitarias de Tailwind CSS.
6. Corrige cualquier incompatibilidad de React 19 (como el uso obsoleto de refs, propTypes o métodos de clase heredados).
7. Mantén toda la funcionalidad, interactividad y lógica del componente original de Claude.
8. No asumas que el usuario tiene componentes secundarios definidos externamente a menos que los incluyas en el mismo archivo refactorizado. Consolídalos en un único archivo modular autoportante.

Código original de Claude:
\`\`\`
${code}
\`\`\`
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Eres un experto en migraciones de React, Tailwind CSS y Vite. Tu tarea es recibir código de Claude Artifacts (que pueden ser componentes de React, HTML estático o aplicaciones web completas) y transformarlos de manera segura a un único archivo de componente React modular, completamente funcional y tipado en TypeScript, compatible con React 19 y Tailwind CSS v4.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            success: { type: Type.BOOLEAN },
            refactoredCode: { 
              type: Type.STRING, 
              description: "El código fuente de React completo y refactorizado que exporta default un único componente compatible con React 19 y Tailwind CSS v4." 
            },
            analysis: { 
              type: Type.STRING, 
              description: "Análisis detallado en Markdown en español que explica los cambios realizados, las adaptaciones de dependencias y consejos de integración." 
            },
            suggestedPackages: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de paquetes npm requeridos para que funcione el componente (ej. ['recharts', 'lucide-react', 'motion/react'])."
            }
          },
          required: ["success", "refactoredCode", "analysis", "suggestedPackages"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No se recibió respuesta de Gemini.");
    }

    const result = JSON.parse(responseText.trim());
    res.json(result);
  } catch (error: any) {
    console.error("Error al analizar código con Gemini:", error);
    res.status(500).json({ 
      success: false, 
      error: `Error de análisis de IA: ${error.message || error}` 
    });
  }
});

app.post("/api/migrate/apply", async (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ success: false, error: "Se requiere el código para aplicar." });
  }

  try {
    const targetPath = path.join(process.cwd(), "src", "ImportedApp.tsx");
    fs.writeFileSync(targetPath, code, "utf8");
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error al escribir ImportedApp.tsx:", error);
    res.status(500).json({ success: false, error: `Error al aplicar código: ${error.message || error}` });
  }
});

app.post("/api/migrate/reset", async (req, res) => {
  try {
    const targetPath = path.join(process.cwd(), "src", "ImportedApp.tsx");
    const defaultPlaceholder = `import React from 'react';

export default function ImportedApp() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 p-8 text-center bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
      <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-slate-200">No se ha importado ninguna aplicación todavía</p>
      <p className="text-sm text-slate-400 max-w-sm mt-2">
        Pega el código de tu Artifact de Claude o arrastra un archivo en el panel de ClaudeBridge para ver tu app funcionando aquí al instante.
      </p>
    </div>
  );
}
`;
    fs.writeFileSync(targetPath, defaultPlaceholder, "utf8");
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error al restablecer ImportedApp.tsx:", error);
    res.status(500).json({ success: false, error: `Error al restablecer: ${error.message || error}` });
  }
});

// CLOUD SYNCHRONIZATION FOR CLINICS AND SCHOOLS (NeuroPlaneta Enterprise)
const DB_FILE_PATH = path.join(process.cwd(), "patients_db.json");

app.post("/api/sync/save", (req, res) => {
  try {
    const { patients } = req.body;
    if (!patients || !Array.isArray(patients)) {
      return res.status(400).json({ success: false, error: "Datos de pacientes no válidos o vacíos." });
    }
    
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(patients, null, 2), "utf8");
    console.log(`Cloud Sync: Saved data for ${patients.length} patients successfully.`);
    res.json({ success: true, count: patients.length, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Error saving clinic data to local database file:", error);
    res.status(500).json({ success: false, error: `Error de almacenamiento en la nube: ${error.message}` });
  }
});

app.get("/api/sync/load", (req, res) => {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      return res.json({ success: true, patients: null, msg: "No database file found on server. Using local cache." });
    }
    
    const fileContent = fs.readFileSync(DB_FILE_PATH, "utf8");
    const patients = JSON.parse(fileContent);
    res.json({ success: true, patients, count: patients.length, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Error reading clinic data from local database file:", error);
    res.status(500).json({ success: false, error: `Error al cargar desde la nube: ${error.message}` });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
