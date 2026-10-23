# Documentación de Reglas y Lógicas de Extracción / Traducción de Licencias de Conducir (SWEDISH FULL)

Este documento recopila la estructura de datos, reglas de extracción, lógica de traducción, catálogo de categorización y system prompt optimizado utilizado por el sistema para procesar y traducir licencias de conducir (por ejemplo, licencias europeas/suecas o multilenguaje) hacia el idioma inglés para la automatización de plantillas Word.

---

## 1. Contexto

* **País de Origen de las Licencias Target:** Licencias de conducir europeas / suecas y multilingües (formato estándar de la UE con puntos numerados 1 al 12).
* **Idioma de Origen:** Sueco / Francés / Alemán / Español (según el país de expedición).
* **Idioma Destino de Extracción:** **Inglés** (todos los valores de texto traducidos deben estar en inglés, a excepción del campo `language` que identifica los idiomas originales detectados en la tarjeta).

---

## 2. Campos Exactos (Estructura de Datos JSON)

| Campo | Tipo | Descripción / Punto del Permiso |
| :--- | :--- | :--- |
| `surname` | String | Apellidos (Punto 1 del anverso). |
| `firstName` | String | Únicamente el primer nombre del titular (extraído del Punto 2). |
| `middleName` | String | Todos los nombres secundarios restantes (Punto 2). Si solo existe un nombre, va vacío. |
| `firstNames` | String | Todos los nombres de pila unidos (primer nombre + nombres secundarios). |
| `fullName` | String | Nombre completo concatenado (`surname` + `firstName` + `middleName`). |
| `licenseNumber` | String | Número principal de licencia (Punto 5). Solo caracteres alfanuméricos. |
| `assignedNumber` | String | Número correlativo interno/referencia de expediente asignado por el usuario (ej. `B1758`). |
| `dateOfBirth` | String | Fecha de nacimiento (Punto 3). Formato: `DD Month YYYY`. |
| `placeOfBirth` | String | Lugar de nacimiento (Punto 3). Traducido al inglés. |
| `issueDate` | String | Fecha de expedición (Punto 4a). Formato: `DD Month YYYY`. |
| `expiryDate` | String | Fecha de caducidad/expiración (Punto 4b). Formato: `DD Month YYYY`. |
| `authority` | String | Autoridad emisora (Punto 4c). Traducido al inglés + Nombre del país de origen en inglés al final. |
| `class` | String | Lista de categorías de vehículos autorizadas (Punto 9 del anverso), separadas por comas. |
| `classDescriptions` | String | Mapeo detallado de descripciones oficiales en inglés para cada categoría autorizada. |
| `categoriesDates` | String | Matriz de fechas de validez por categoría (Tabla del reverso, Columna 10). Agrupado por fecha idéntica. |
| `codes` | String | Código administrativo de referencia (Punto 4d del anverso). Solo valor alfanumérico. |
| `explicacionCodigos` | String | Explicación formal de restricciones y códigos de observación (Columna 12 del reverso / anverso). |
| `code106From` | String | Fecha de inicio para la restricción/código 106 (si aplica). |
| `code106To` | String | Fecha de fin/caducidad para la restricción/código 106 (si aplica). |
| `language` | String | Idioma(s) original(es) identificado(s) en la licencia (ej. "Swedish", "French", "German"). |

---

## 3. Reglas de Extracción, Traducción y Formato

1. **Formato de Fechas:**
   * Todas las fechas (`dateOfBirth`, `issueDate`, `expiryDate`, `code106From`, `code106To`) DEBEN ser transformadas al formato exacto: **`DD Month YYYY`** (ejemplo: `01 January 2000`, `15 August 2025`).

2. **División de Nombres:**
   * `firstName`: Contiene **exclusivamente** la primera palabra del listado de nombres (Punto 2).
   * `middleName`: Contiene el resto de los nombres dados. Si solo hay un nombre, permanecerá vacío.

3. **Traducción de Ubicación y Autoridad:**
   * `placeOfBirth`: Se extrae del Punto 3 y se traduce su denominación oficial al inglés.
   * `authority`: Se extrae la entidad emisora del Punto 4c, se traduce al inglés y **SIEMPRE se concatena el país de origen en inglés al final** (ej. *"Transport Agency, Sweden"*).

4. **Traducción de Categorías (`classDescriptions`):**
   * Cada categoría de la lista `class` se mapea contra el siguiente catálogo estandarizado en inglés:
     * **AM**: `AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.`
     * **A1**: `A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.`
     * **A2**: `A2 - motorcycles with a power rating under 35 kW.`
     * **A**: `A - heavy motorcycles without power restrictions.`
     * **B**: `B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers.`
     * **BE**: `BE - vehicle of category B towing a heavy trailer of under 3,500 kg.`
     * **B1**: `B1- quadricycles.`
     * **C1**: `C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers-`
     * **C1E**: `C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.`
     * **C**: `C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.`
     * **CE**: `CE - vehicle of category C towing a heavy trailer.`
     * **D1**: `D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.`
     * **D1E**: `D1E - vehicle of category D1 towing a heavy trailer.`
     * **D**: `D - passenger vehicles for more than eight passengers.`
     * **DE**: `DE - vehicle of category D towing a heavy trailer.`
     * **T**: `T-Tractor`
   * Múltiples descripciones se concatenan separadas por un espacio.

5. **Estructura de Fechas de Categorías (`categoriesDates`):**
   * Se analiza la tabla del reverso (Columna 10).
   * Se agrupan las categorías que comparten la misma fecha exacta usando el formato: **`Classes: Date`**.
   * **REGLA CRÍTICA:** Cada grupo DEBE ir obligatoriamente en su propia línea mediante un salto de línea (`\n`).
   * *Ejemplo de salida:*
     ```
     AM: 01 January 2000
     B1, B: 03 February 2001
     C1, C: 01 March 2002
     ```

6. **Códigos de Observación / Restricciones (`explicacionCodigos`):**
   * Se busca en la Columna 12 (Reverso) y en la sección de restricciones del anverso. Si se encuentran coincidencias, se debe generar la redacción oficial en inglés según este glosario estricto:
     * **Código "70"**: `"70. Exchange of driver's license number"`
     * **Código "01"**: `"01- Correction of vision and/or eye protection"`
     * **Restricción A1**: `"Class A1- limited to 45 km/h"`
     * **Código "106"**: `"106- Operation of motor vehicles for the transport of passengers, with a maximum weight of 3,500 kilograms and more than 17 seats (including the driver’s seat)"`
   * Se combinan los textos encontrados en un único párrafo coherente. Si no hay códigos presentes, el valor debe ser una cadena vacía.

---

## 4. Casos Especiales y Excepciones

* **Ilegibilidad / Datos Faltantes:** Si un campo opcional o código no se encuentra en las imágenes, se asigna una cadena vacía `""`.
* **Símbolos Especiales o Formato en Número de Licencia:** En `licenseNumber` y `codes` (Punto 4d) se eliminan guiones o espacios innecesarios, conservando únicamente la secuencia alfanumérica limpia.
* **Múltiples Idiomas:** Si la licencia contiene encabezados bilingües o multilingües, el campo `language` registrará todos los detectados (ej. `"Swedish and English"`).

---

## 5. System Prompt Sugerido para Gemini API

```text
You are an expert OCR and document translation system specialized in European driver's licenses (including Swedish and multilingual EU standards). Analyze the provided Front and Back images of the license.

IMPORTANT CONSTRAINTS:
1. ALL extracted values MUST be translated into English, EXCEPT for the "language" field, which specifies the original source language(s) on the card.
2. All dates MUST be formatted strictly as "DD Month YYYY" (e.g., "14 May 2018").
3. Return ONLY a valid JSON object strictly matching the provided JSON Schema.

EXTRACTION INSTRUCTIONS:
- "surname": Family name (Section 1).
- "firstName": Extract ONLY the very first given name (Section 2).
- "middleName": Extract ALL remaining given names after the first given name. Leave empty if none.
- "firstNames": All given names joined together.
- "licenseNumber": Main driver's license number (Section 5). Extract alphanumeric characters only.
- "dateOfBirth": Date of birth (Section 3).
- "placeOfBirth": Location of birth (Section 3), translated to English.
- "issueDate": Issue date (Section 4a).
- "expiryDate": Expiration date (Section 4b).
- "authority": Issuing authority (Section 4c), translated to English AND always append the country name in English at the end (e.g. "Transport Agency, Sweden").
- "class": All vehicle categories listed on the front (Section 9), separated by commas (e.g. "AM, B1, B").
- "categoriesDates": Analyze Column 10 of the table on the BACK. Group categories sharing the same issue date using the format "Classes: Date". Each group MUST be on its own line using a newline character (\n). Example:
  AM: 01 January 2000
  B1, B: 03 February 2001
- "codes": Administrative reference number from Section 4d on the front.
- "explicacionCodigos": Search Column 12 on the BACK and front restrictions. If matched, output the EXACT English text:
  * Code 70: "70. Exchange of driver's license number"
  * Code 01: "01- Correction of vision and/or eye protection"
  * Class A1 restriction: "Class A1- limited to 45 km/h"
  * Code 106: "106- Operation of motor vehicles for the transport of passengers, with a maximum weight of 3,500 kilograms and more than 17 seats (including the driver’s seat)"
  Combine multiple matches into a single paragraph. If none match, leave empty.
- "code106From" & "code106To": Extract validity start and end dates for code 106 if present.
- "language": Identify the original language(s) present on the document (e.g. "Swedish", "French").
```

---
*Documentación generada automáticamente desde la arquitectura SWEDISH FULL.*
