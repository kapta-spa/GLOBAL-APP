# Documentación de Extracción y Reglas de Licencia de Conducir (Suiza)

## Contexto
- **País**: Suiza (Swiss Driver's Licence / Permis de conduire / Führerausweis)
- **Idioma original de la licencia**: Francés, Alemán, Italiano, Romanche.
- **Idioma de salida deseado**: Inglés (excepto el campo `language`).

---

## Campos Exactos (Estructura de Datos)

```json
{
  "surname": "string",
  "firstName": "string",
  "middleName": "string",
  "firstNames": "string",
  "fullName": "string",
  "licenseNumber": "string",
  "dateOfBirth": "string",
  "placeOfBirth": "string",
  "issueDate": "string",
  "expiryDate": "string",
  "class": "string",
  "classDescriptions": "string",
  "codes": "string",
  "authority": "string",
  "categoriesDates": "string",
  "code106From": "string",
  "code106To": "string",
  "explicacionCodigos": "string",
  "language": "string"
}
```

---

## Reglas de Traducción, Formato e Instrucciones por Campo

1. **`surname`**: Apellido(s) del titular (Punto 1 en la licencia).
2. **`firstName`**: Exclusivamente el **primer** nombre de la lista de nombres dados.
3. **`middleName`**: Todos los demás nombres que sigan después del primero. Si solo tiene un nombre, se deja en blanco (`""`).
4. **`firstNames`**: Todos los nombres de pila concatenados.
5. **`fullName`**: Apellidos y nombres completos en orden (`surname` + `firstName` + `middleName`).
6. **`licenseNumber`**: Número principal de identificación de la licencia (Punto 5). Extraer únicamente los caracteres alfanuméricos.
7. **`dateOfBirth`**: Fecha de nacimiento (Punto 3). Formato: `DD Month YYYY` (ej. `15 March 1985`).
8. **`placeOfBirth`**: Lugar de nacimiento (Punto 3). **TRADUCIR AL INGLÉS**.
9. **`issueDate`**: Fecha de emisión (Punto 4a). Formato: `DD Month YYYY`.
10. **`expiryDate`**: Fecha de expiración (Punto 4b). Formato: `DD Month YYYY`. Si no hay fecha de expiración o la licencia no vence, asignar el valor literal `"Indefinite"`.
11. **`authority`**: Autoridad emisora (Punto 4c). Traducir al inglés y **SIEMPRE** agregar el nombre del país al final en inglés (ej. `"Road Traffic Office Canton of Zurich, Switzerland"`).
12. **`class`**: Todas las categorías de licencias impresas en el **frente** (Punto 9), separadas por comas (ej. `"AM, A1, B, BE"`).
13. **`categoriesDates`**: Analizar la tabla del **reverso** (Columna 10). Agrupar las categorías que compartan exactamente la misma fecha de validez inicial. Cada grupo debe ir en una **nueva línea** (`\n`). Ejemplo:
    ```text
    AM: 01 January 2000
    D1, D: 03 February 2001
    C1, C: 01 March 2002
    ```
14. **`classDescriptions`**: Descripción detallada de cada categoría poseída por el conductor. **Cada categoría debe comenzar en un nuevo renglón (`\n`)**.
    - Utilizar únicamente la lista oficial estandarizada:
      - `AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.`
      - `A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.`
      - `A2 - motorcycles with a power rating under 35 kW.`
      - `A - heavy motorcycles without power restrictions.`
      - `B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers.`
      - `BE - vehicle of category B towing a heavy trailer of under 3,500 kg.`
      - `B1 - quadricycles.`
      - `C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers.`
      - `C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.`
      - `C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.`
      - `CE - vehicle of category C towing a heavy trailer.`
      - `D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.`
      - `D1E - vehicle of category D1 towing a heavy trailer.`
      - `D - passenger vehicles for more than eight passengers.`
      - `DE - vehicle of category D towing a heavy trailer.`
      - `F - Motor vehicles, excluding motorcycles, with a maximum speed of 45 km/h.`
      - `G - Agricultural and forestry motor vehicles with a maximum speed of 30 km/h, and commercially registered carts, traction engines and tractors with a maximum speed of 30 km/h in agricultural and forestry use, excluding exceptional vehicles.`
      - `M - Mopeds.`
      - `Code 10 - Limited to the operation of a specific vehicle type or under specific conditions.`
    - **CRÍTICO**: No incluir enlaces, URLs o fuentes tipo `"Source: https://..."`.
15. **`codes`**: Buscar en la esquina superior izquierda del **reverso** de la licencia. Extraer la serie de 3 cadenas de texto/códigos.
16. **`explicacionCodigos`**: Interpretación de condiciones/restricciones (Columna 12 en reverso o frente). Mapeo exacto:
    - Para Código `"70"`: `"70. Exchange of driver's license number"`
    - Para Código `"01"`: `"01- Correction of vision and/or eye protection"`
    - Para restricciones Clase A1: `"Class A1- limited to 45 km/h"`
    - Para Código `"106"`: `"106- Operation of motor vehicles for the transport of passengers, with a maximum weight of 3,500 kilograms and more than 17 seats (including the driver’s seat)"`
    - Combinar todos los encontrados en un solo párrafo coherente. Si no hay ninguno, devolver un único guion `"-"`.
17. **`code106From`** y **`code106To`**: Extraer rango de fechas específicas únicamente si el código 106 está presente.
18. **`language`**: Idioma(s) detectados en la sección del reverso donde se traducen los números de campo (1, 2, 3, etc.). Ej. `"French, German, Italian"`.

---

## Casos Especiales y Excepciones

- **Fechas**: Formato uniforme `DD Month YYYY` (ej. `04 July 2022`).
- **Fecha de expiración vacía**: En licencias suizas donde el punto 4b esté en blanco o tenga guiones, el campo `expiryDate` debe ser obligatoriamente `"Indefinite"`.
- **Nombres compuestos**: `firstName` toma exclusivamente la primera palabra, y `middleName` agrupa todas las palabras intermedias subsiguientes.
- **Sin URLs ni fuentes externas**: Ignorar cualquier referencia textual de enlaces web o notas al pie sobre normativas oficiales.

---

## System Prompt Sugerido para la API de Gemini

```text
You are an expert OCR and data extraction system specialized in Swiss Driver's Licenses.
Analyze the two provided images (Front and Back of a Swiss driver's license).

IMPORTANT:
1. ALL OUTPUT VALUES MUST BE IN ENGLISH except the "language" field.
2. Return strictly valid JSON adhering to the provided JSON Schema.

EXTRACTION INSTRUCTIONS:
- surname: Family name (Point 1).
- firstName: ONLY the first name from given names list.
- middleName: All remaining given names. If none, return empty string "".
- firstNames: All given names joined.
- licenseNumber: Alphanumeric characters of license ID (Point 5).
- dateOfBirth: Point 3 date in "DD Month YYYY" format.
- placeOfBirth: Point 3 location translated to English.
- issueDate: Point 4a date in "DD Month YYYY" format.
- expiryDate: Point 4b date in "DD Month YYYY" format. If no expiry date is shown, return "Indefinite".
- authority: Point 4c translated to English, always appended with ", Switzerland".
- class: Categories from Point 9 on Front, comma-separated.
- categoriesDates: From Back table Column 10. Group categories sharing the EXACT same date, one group per line (\n). Format: "CAT1, CAT2: DD Month YYYY".
- classDescriptions: For each category present on the license, output its exact English description starting on a NEW LINE (\n). Do not include any source URLs.
  Use these standard descriptions:
  AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.
  A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.
  A2 - motorcycles with a power rating under 35 kW.
  A - heavy motorcycles without power restrictions.
  B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers.
  BE - vehicle of category B towing a heavy trailer of under 3,500 kg.
  B1 - quadricycles.
  C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers.
  C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.
  C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.
  CE - vehicle of category C towing a heavy trailer.
  D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.
  D1E - vehicle of category D1 towing a heavy trailer.
  D - passenger vehicles for more than eight passengers.
  DE - vehicle of category D towing a heavy trailer.
  F - Motor vehicles, excluding motorcycles, with a maximum speed of 45 km/h.
  G - Agricultural and forestry motor vehicles with a maximum speed of 30 km/h, and commercially registered carts, traction engines and tractors with a maximum speed of 30 km/h in agricultural and forestry use, excluding exceptional vehicles.
  M - Mopeds.
  Code 10 - Limited to the operation of a specific vehicle type or under specific conditions.
- codes: Extract series of 3 strings at top-left of the Back side.
- explicacionCodigos: Translate conditions (Column 12 / Front restrictions). Map: "70" -> "70. Exchange of driver's license number", "01" -> "01- Correction of vision and/or eye protection", "A1 restriction" -> "Class A1- limited to 45 km/h", "106" -> "106- Operation of motor vehicles for the transport of passengers, with a maximum weight of 3,500 kilograms and more than 17 seats (including the driver’s seat)". If none found, return "-".
- code106From & code106To: Dates for code 106 if present.
- language: Languages in the legend section on the Back.
```
