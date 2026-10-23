export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'AM': 'AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.',
  'A1': 'A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.',
  'A2': 'A2 - motorcycles with a power rating under 35 kW.',
  'A': 'A - heavy motorcycles without power restrictions.',
  'B1': 'B1 - heavy motorized quadricycle whose empty weight is a maximum of 450 kg if it is intended for the transport of persons, and 600 kg if it is intended for the transport of goods.',
  'B': 'B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers, in addition to the driver.',
  'BE': 'BE - vehicle of category B towing a heavy trailer of under 3,500 kg.',
  'C1': 'C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers-',
  'C1E': 'C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.',
  'C': 'C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.',
  'CE': 'CE - vehicle of category C towing a heavy trailer.',
  'D1': 'D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.',
  'D1E': 'D1E - vehicle of category D1 towing a heavy trailer.',
  'D': 'D - passenger vehicles for more than eight passengers.',
  'DE': 'DE - vehicle of category D towing a heavy trailer.',
  'G': 'G - Agricultural and forestry tractors and their trailers, including certain vehicles registered as agricultural machinery.',
};

export const ORDERED_CATEGORIES = [
  'AM', 'A1', 'A2', 'A',
  'B1', 'B', 'BE',
  'C1', 'C1E', 'C', 'CE',
  'D1', 'D1E', 'D', 'DE',
  'G'
];

/**
 * Extracts permitted category descriptions based solely on the driver's permitted categories.
 * Handles inputs like "AM, B", "B, A2", etc.
 */
export const formatClassDescriptions = (classInput?: string): string => {
  if (!classInput) return '';

  // Clean and split by commas, slashes, spaces or semicolons
  const rawTokens = classInput
    .toUpperCase()
    .replace(/[;/\\]/g, ',')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const foundCategories = new Set<string>();

  for (const token of rawTokens) {
    // Check exact matches or tokens inside
    if (CATEGORY_DESCRIPTIONS[token]) {
      foundCategories.add(token);
    } else {
      // Sometimes tokens are like "AM B" or "B1/B"
      const subParts = token.split(/[\s/]+/).map(p => p.trim());
      for (const sub of subParts) {
        if (CATEGORY_DESCRIPTIONS[sub]) {
          foundCategories.add(sub);
        }
      }
    }
  }

  // Also scan if any ordered category is explicitly isolated in the text
  for (const cat of ORDERED_CATEGORIES) {
    const regex = new RegExp(`\\b${cat}\\b`, 'i');
    if (regex.test(classInput)) {
      foundCategories.add(cat);
    }
  }

  // Preserve ordered listing of only permitted categories
  const descriptions: string[] = [];
  for (const cat of ORDERED_CATEGORIES) {
    if (foundCategories.has(cat)) {
      descriptions.push(CATEGORY_DESCRIPTIONS[cat]);
    }
  }

  return descriptions.join('\n');
};

export const RULES_DOCUMENTATION_MARKDOWN = `# Reglas de Extracción, Traducción y Lógica de Licencias de Conducir (Bélgica / Francia -> UK)

## 1. Contexto
- **País de Origen:** Bélgica / Francia (Unión Europea).
- **Idioma(s) del Documento Original:** Francés (*Permis de conduire*), Neerlandés (*Rijbewijs*), Alemán (*Führerschein*).
- **Idioma Objetivo / Traducción:** Inglés estándar (Reino Unido / UK Sworn Standard).

---

## 2. Campos Exactos (Estructura de Datos / JSON)
Los campos extraídos en la estructura JSON devuelta por la API son:

| Campo | Etiqueta / Tag Word | Tipo | Descripción |
|---|---|---|---|
| \`surname\` | \`{{surname}}\` | String | Apellido(s) del titular (Punto 1). |
| \`firstName\` | \`{{firstName}}\` | String | ÚNICAMENTE el primer nombre de pila (Punto 2). |
| \`middleName\` | \`{{middleName}}\` | String | Nombres secundarios o restantes. Vacío si solo tiene uno. |
| \`firstNames\` | \`{{firstNames}}\` | String | Todos los nombres de pila concatenados. |
| \`fullName\` | \`{{fullName}}\` | String | Nombre completo: Surname + First Name + Middle Name. |
| \`licenseNumber\` | \`{{licenseNumber}}\` | String | Número de licencia alfanumérico principal (Punto 5). |
| \`assignedNumber\` | \`{{assignedNumber}}\` | String | Código/Número de referencia de expediente asignado por la oficina. |
| \`dateOfBirth\` | \`{{dateOfBirth}}\` | String | Fecha de nacimiento (Punto 3). Formato: \`DD Month YYYY\`. |
| \`placeOfBirth\` | \`{{placeOfBirth}}\` | String | Lugar de nacimiento traducido al inglés (Punto 3). |
| \`issueDate\` | \`{{issueDate}}\` | String | Fecha de expedición (Punto 4a). Formato: \`DD Month YYYY\`. |
| \`expiryDate\` | \`{{expiryDate}}\` | String | Fecha de vencimiento (Punto 4b). Formato: \`DD Month YYYY\`. |
| \`authority\` | \`{{authority}}\` | String | Autoridad emisora traducida al inglés con país al final (Punto 4c). |
| \`class\` | \`{{class}}\` | String | Categorías autorizadas en el frente (Punto 9), separadas por comas (ej. \`AM, B\`). |
| \`classDescriptions\` | \`{{classDescriptions}}\` | String | **ÚNICAMENTE las descripciones de las categorías permitidas al titular** (una por línea). |
| \`categoriesDates\` | \`{{categoriesDates}}\` | String | Fechas de validez por categoría (Tabla posterior, Columna 10). |
| \`codes\` | \`{{codes}}\` | String | Serie de 3 códigos alfanuméricos en la esquina superior izquierda del reverso. |
| \`explicacionCodigos\` | \`{{explicacionCodigos}}\` | String | Traducción y explicación de restricciones encontradas en Columna 12. |
| \`code106From\` | \`{{code106From}}\` | String | Fecha de inicio del período de prueba (si aplica código 106). |
| \`code106To\` | \`{{code106To}}\` | String | Fecha de fin del período de prueba (si aplica código 106). |
| \`licenseLanguage\` | \`{{licenseLanguage}}\` | String | Idioma(s) detectados del documento (ej. \`French and Dutch\`). |

---

## 3. Reglas de Traducción y Formato Específico

### 3.1. Formato de Fechas
- **Regla Estricta:** Todas las fechas deben formatearse como **\`DD Month YYYY\`** en inglés (ejemplo: \`04 June 2018\`, \`15 October 1985\`).
- Nunca usar formatos numéricos ambiguos como \`04/06/2018\` o \`06/04/2018\`.

### 3.2. División de Nombres
- **\`firstName\`**: Contiene única y exclusivamente el primer nombre de la lista del punto 2.
- **\`middleName\`**: Contiene todos los demás nombres listados tras el primero. Si no existen, se deja como cadena vacía.
- **\`fullName\`**: Unión de \`surname\` + \`firstName\` + \`middleName\`.

### 3.3. Autoridad Emisora (\`authority\`)
- Traducir la autoridad al inglés y colocar siempre el país al final:
  - *Ejemplo:* "Commune d'Uccle" -> "Municipality of Uccle, Belgium".
  - *Ejemplo:* "Ville de Bruxelles" -> "City of Brussels, Belgium".
  - *Ejemplo:* "Préfecture de Police" -> "Police Prefecture, France".

### 3.4. Campo \`classDescriptions\` (Catálogo Estricto de Categorías Permitidas)
Se debe incluir **única y exclusivamente** el texto de las categorías que el conductor tiene permitidas:

- **AM**: \`AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.\`
- **A1**: \`A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.\`
- **A2**: \`A2 - motorcycles with a power rating under 35 kW.\`
- **A**: \`A - heavy motorcycles without power restrictions.\`
- **B1**: \`B1 - heavy motorized quadricycle whose empty weight is a maximum of 450 kg if it is intended for the transport of persons, and 600 kg if it is intended for the transport of goods.\`
- **B**: \`B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers, in addition to the driver.\`
- **BE**: \`BE - vehicle of category B towing a heavy trailer of under 3,500 kg.\`
- **C1**: \`C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers-\`
- **C1E**: \`C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.\`
- **C**: \`C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.\`
- **CE**: \`CE - vehicle of category C towing a heavy trailer.\`
- **D1**: \`D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.\`
- **D1E**: \`D1E - vehicle of category D1 towing a heavy trailer.\`
- **D**: \`D - passenger vehicles for more than eight passengers.\`
- **DE**: \`DE - vehicle of category D towing a heavy trailer.\`
- **G**: \`G - Agricultural and forestry tractors and their trailers, including certain vehicles registered as agricultural machinery.\`

### 3.5. Códigos Comunitarios y Restricciones (\`explicacionCodigos\`)
Analizar la Columna 12 en el reverso y generar el párrafo formal en inglés con las siguientes equivalencias:
- **Código 70**: \`70. Exchange of driver's license number [extract number]\`
- **Código 01**: \`01- Vision correction and/or protection\`
- **Código 01.06**: \`01.06- Prescribed spectacles or contact lenses\`
- **Código 106**: \`106- Subject to the application of article R. 413-5 during probationary period from [DateFrom] to [DateTo] (Speed limits: 110km/h in Freeways where limit is 130km/h, 100km/h in freeways with lower speed limit or double roads, 80 km/h on other roads.)\`

---

## 4. Casos Especiales y Manejo de Excepciones
1. **Dato borroso o ilegible:** Si un campo es completamente ilegible tras mejorar contraste, indicar \`[Unreadable]\` en vez de inventar datos.
2. **Sin fecha de vencimiento (Punto 4b):** Algunas licencias antiguas tienen validez indeterminada o vacía. Indicar \`Indefinite\` o dejar en blanco según plantilla.
3. **Licencias multilingües:** La licencia belga a menudo tiene encabezados en francés, neerlandés y alemán (*Royaume de Belgique / Koninkrijk België / Königreich Belgien*). Registrar en \`licenseLanguage\` todos los idiomas presentes.
4. **Campo \`codes\` (reverso superior izquierdo):** Extraer los 3 bloques que identifican la tirada/impresión física de la tarjeta.

---

## 5. System Prompt Sugerido para la API de Gemini

\`\`\`text
You are an expert official translator and OCR forensic specialist specializing in European Union driver's licenses (Belgium, France) translated into certified UK English.

Your task is to analyze the front and back images of the driver's license and extract all fields into a structured JSON format according to these strict rules:

1. LANGUAGE: All output text values MUST be translated into English (UK).
2. DATES: Format all dates strictly as "DD Month YYYY" (e.g., "15 March 2020").
3. NAME SEPARATION:
   - "surname": Family name(s) (Point 1).
   - "firstName": Strictly ONLY the first given name (Point 2).
   - "middleName": Any subsequent given names. Empty if only one given name.
   - "fullName": Combined surname and all given names.
4. LICENSE NUMBER: Alphanumeric characters only (Point 5).
5. AUTHORITY: Translate authority to English and always append ", [Country]" at the end (e.g., "City of Brussels, Belgium").
6. CATEGORIES:
   - "class": Comma-separated list of permitted categories shown on Point 9 or Table 10 (e.g., "AM, B").
   - "classDescriptions": For ONLY the categories the driver is permitted to have, output their exact official English definition from the authorized catalog, one per line:
     AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.
     A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.
     A2 - motorcycles with a power rating under 35 kW.
     A - heavy motorcycles without power restrictions.
     B1 - heavy motorized quadricycle whose empty weight is a maximum of 450 kg if it is intended for the transport of persons, and 600 kg if it is intended for the transport of goods.
     B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers, in addition to the driver.
     BE - vehicle of category B towing a heavy trailer of under 3,500 kg.
     C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers-
     C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.
     C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.
     CE - vehicle of category C towing a heavy trailer.
     D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.
     D1E - vehicle of category D1 towing a heavy trailer.
     D - passenger vehicles for more than eight passengers.
     DE - vehicle of category D towing a heavy trailer.
     G - Agricultural and forestry tractors and their trailers, including certain vehicles registered as agricultural machinery.
7. RESTRICTIONS / CODES (Column 12):
   Translate recognized EU codes:
   - 70: "70. Exchange of driver's license number [number]"
   - 01: "01- Vision correction and/or protection"
   - 01.06: "01.06- Prescribed spectacles or contact lenses"
   - 106: "106- Subject to the application of article R. 413-5 during probationary period from [DateFrom] to [DateTo] (Speed limits: 110km/h in Freeways where limit is 130km/h, 100km/h in freeways with lower speed limit or double roads, 80 km/h on other roads.)"
8. Return strictly a JSON object conforming to the required schema.
\`\`\`
`;

export const downloadRulesDoc = () => {
  const blob = new Blob([RULES_DOCUMENTATION_MARKDOWN], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reglas_extraccion_licencias_belgica_francia.txt';
  a.click();
  URL.revokeObjectURL(url);
};

