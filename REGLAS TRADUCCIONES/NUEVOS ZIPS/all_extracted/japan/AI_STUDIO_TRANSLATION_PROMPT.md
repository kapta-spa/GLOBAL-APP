# Japanese Driver's License Translation - Google AI Studio Prompt & Configuration Guide

Este archivo contiene el prompt completo, las instrucciones del sistema, el esquema JSON (Structured Output) y las reglas de negocio exactas utilizadas para la extracción y traducción de licencias de conducir japonesas (運転免許証) al inglés.

---

## 1. Configuración del Modelo en Google AI Studio

- **Modelo recomendado**: `gemini-2.5-flash` o `gemini-1.5-flash` / `gemini-1.5-pro` (Multimodal: acepta imágenes de frente y reverso)
- **Response MIME Type**: `application/json`
- **Temperature**: `0.1` o `0.2` (Baja temperatura para máxima precisión en datos estructurados y fechas)

---

## 2. System Instructions / Prompt de Extracción

Copia y pega este texto en el campo **System Instructions** o como **User Prompt** junto con las imágenes del frente y reverso de la licencia:

```text
You are an expert Japanese-to-English translator and OCR specialist for official documents, specializing in Japanese Driver's Licenses (運転免許証).

Extract all information from the provided Japanese Driver's License (front and back images) and translate/transliterate it into English following these strict rules:

### FIELD RULES & SPECIFICATIONS:

1. surname:
   - Family name in English Romaji (Hepburn Romanization, Capitalized, e.g., "Yamaki").
   - Extract strictly from the name section (氏名).

2. firstNames:
   - Given name(s) in English Romaji (Hepburn Romanization, Capitalized, e.g., "Taro").

3. fullName:
   - Full name in English formatted as "Surname GivenNames" (e.g., "Yamaki Taro").

4. licenseNumber:
   - Exactly the 12-digit license number (番号).

5. assignedNumber:
   - Any document or reference number found, or repeat the license number if no separate assigned number is present.

6. dateOfBirth:
   - Date of birth converted from Japanese Imperial Era (Showa/Heisei/Reiwa) to Western format: "DD Month YYYY" (e.g., "15 August 1988").

7. placeOfBirth / nationality:
   - Prefecture (or Country) in English (e.g., "Tokyo, Japan").

8. issueDate:
   - Issue/Delivery date (交付) converted to Western format: "DD Month YYYY" (e.g., "10 April 2021").

9. expiryDate:
   - Expiry date (有効期限) converted to Western format: "DD Month YYYY" (e.g., "25 May 2026").

10. address:
    - Full address translated and romanized to English standard order (Building, Block/Number, Sub-district/Machi/Cho, City/Ward, Prefecture, Japan).

11. authority:
    - Issuing Public Safety Commission / Authority translated to English with ", Japan" suffix.
    - Example: "Tokyo Metropolitan Public Safety Commission, Japan" or "Kanagawa Public Safety Commission, Japan".

12. class (Licence Categories / 種類):
    - Map the license categories on the front/bottom matrix using standard English naming.
    - ALWAYS append "Vehicle" to categories:
      * 普通 -> "Ordinary Vehicle"
      * 準中型 -> "Semi-Medium Vehicle"
      * 中型 -> "Medium Vehicle"
      * 大型 -> "Large Vehicle"
      * 大特 -> "Large Special Vehicle"
      * 小特 -> "Small Special Vehicle"
      * 大自二 -> "Large Motorcycle"
      * 普自二 -> "Ordinary Motorcycle"
      * 原付 -> "Moped"
      * け引 / 牽引 -> "Towing Vehicle"
    - If multiple categories are held, list them separated by commas or new lines (e.g., "Ordinary Vehicle, Ordinary Motorcycle").

13. codes (Conditions applying to licence / 免許の条件等):
    - CRITICAL RULES:
      * If the condition is "眼鏡等" or translates to glasses/lenses, ALWAYS translate strictly as "Prescribed spectacles".
      * If there is an automatic transmission restriction (AT車に限る), translate as "Ordinary vehicles limited to AT" (or matching class).
      * If there are multiple conditions, output EACH condition on its own NEW LINE (\n).
      * Example:
        Prescribed spectacles\nOrdinary vehicles limited to AT

14. categoriesDates:
    - Initial acquisition dates for categories (二・小・原, 他, etc.) converted to "DD Month YYYY".

### OUTPUT FORMAT:
Output strictly valid JSON matching the schema. Do NOT include Japanese characters in the final values. Do NOT invent information that is not present on the card.
```

---

## 3. Response Schema (JSON Schema para AI Studio)

En Google AI Studio, activa **Structured Outputs (JSON)** y usa este schema:

```json
{
  "type": "object",
  "properties": {
    "surname": {
      "type": "string",
      "description": "Family name in Romaji"
    },
    "firstNames": {
      "type": "string",
      "description": "Given names in Romaji"
    },
    "fullName": {
      "type": "string",
      "description": "Full name (Surname FirstNames)"
    },
    "licenseNumber": {
      "type": "string",
      "description": "12-digit Japanese license number"
    },
    "assignedNumber": {
      "type": "string",
      "description": "Document reference or assigned number"
    },
    "dateOfBirth": {
      "type": "string",
      "description": "Date of birth in 'DD Month YYYY' format"
    },
    "placeOfBirth": {
      "type": "string",
      "description": "Prefecture or place of birth in English"
    },
    "issueDate": {
      "type": "string",
      "description": "Issue date in 'DD Month YYYY' format"
    },
    "expiryDate": {
      "type": "string",
      "description": "Expiry date in 'DD Month YYYY' format"
    },
    "address": {
      "type": "string",
      "description": "Full English address"
    },
    "class": {
      "type": "string",
      "description": "Licensed vehicle classes, e.g. 'Ordinary Vehicle, Semi-Medium Vehicle'"
    },
    "codes": {
      "type": "string",
      "description": "Conditions applying to licence separated by newlines (e.g. 'Prescribed spectacles\\nOrdinary vehicles limited to AT')"
    },
    "authority": {
      "type": "string",
      "description": "Issuing authority + ', Japan'"
    },
    "categoriesDates": {
      "type": "string",
      "description": "Category dates list"
    }
  },
  "required": [
    "surname",
    "firstNames",
    "fullName",
    "licenseNumber",
    "dateOfBirth",
    "issueDate",
    "expiryDate",
    "address",
    "class",
    "codes",
    "authority"
  ]
}
```

---

## 4. Ejemplo de Respuesta JSON Esperada

```json
{
  "surname": "Yamaki",
  "firstNames": "Taro",
  "fullName": "Yamaki Taro",
  "licenseNumber": "301234567890",
  "assignedNumber": "301234567890",
  "dateOfBirth": "14 March 1985",
  "placeOfBirth": "Tokyo, Japan",
  "issueDate": "22 October 2021",
  "expiryDate": "14 April 2026",
  "address": "1-2-3 Roppongi, Minato-ku, Tokyo, Japan",
  "class": "Ordinary Vehicle",
  "codes": "Prescribed spectacles\nOrdinary vehicles limited to AT",
  "authority": "Tokyo Metropolitan Public Safety Commission, Japan",
  "categoriesDates": "12 May 2005"
}
```

---

## 5. Implementación en Código con `@google/genai` (SDK TypeScript / JavaScript)

```typescript
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractLicenseData(frontBase64: string, backBase64: string) {
  const parts = [
    { inlineData: { data: frontBase64, mimeType: "image/jpeg" } },
    { inlineData: { data: backBase64, mimeType: "image/jpeg" } },
    {
      text: `Extract info from this Japanese license and translate to English following the system rules.
      - Conditions: Use 'Prescribed spectacles' for glasses. Multi-line with \\n.
      - Class: Map to Ordinary Vehicle, Semi-Medium Vehicle, Medium Vehicle, Large Vehicle, etc.
      - Authority: Must end with ', Japan'.
      - Dates: Convert all imperial Japanese dates to 'DD Month YYYY'.`
    }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          surname: { type: Type.STRING },
          firstNames: { type: Type.STRING },
          fullName: { type: Type.STRING },
          licenseNumber: { type: Type.STRING },
          assignedNumber: { type: Type.STRING },
          dateOfBirth: { type: Type.STRING },
          placeOfBirth: { type: Type.STRING },
          issueDate: { type: Type.STRING },
          expiryDate: { type: Type.STRING },
          address: { type: Type.STRING },
          class: { type: Type.STRING },
          codes: { type: Type.STRING },
          authority: { type: Type.STRING },
          categoriesDates: { type: Type.STRING },
        },
        required: ["surname", "firstNames", "licenseNumber", "class", "codes", "authority"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
```
