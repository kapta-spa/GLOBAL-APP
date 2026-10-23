# Documentación de Extracción y Reglas de Licencia de Conducir (República Checa / Czech Republic)

## Contexto
- **País**: República Checa / Czech Republic (Česká republika - Řidičský průkaz)
- **Idioma original de la licencia**: Checo (Čeština) con modelo estandarizado de la Unión Europea.
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

1. **`surname`**: Apellido(s) del titular (Punto 1 / Příjmení).
2. **`firstName`**: Exclusivamente el **primer** nombre de la lista de nombres de pila (Punto 2 / Jméno).
3. **`middleName`**: Todos los demás nombres que sigan después del primero. Si solo tiene un nombre, se deja en blanco (`""`).
4. **`firstNames`**: Todos los nombres de pila concatenados.
5. **`fullName`**: Apellidos y nombres completos en orden (`surname` + `firstName` + `middleName`).
6. **`licenseNumber`**: Número principal de identificación de la licencia (Punto 5 / Číslo řidičského průkazu). Extraer únicamente los caracteres alfanuméricos.
7. **`dateOfBirth`**: Fecha de nacimiento (Punto 3 / Datum narození). Formato: `DD Month YYYY` (ej. `15 March 1985`).
8. **`placeOfBirth`**: Lugar de nacimiento (Punto 3 / Místo narození). **TRADUCIR AL INGLÉS** (ej. `Prague`, `Brno`, etc.).
9. **`issueDate`**: Fecha de emisión (Punto 4a / Datum vydání). Formato: `DD Month YYYY`.
10. **`expiryDate`**: Fecha de expiración (Punto 4b / Datum platnosti). Formato: `DD Month YYYY`. Si no hay fecha de expiración o la licencia no vence, asignar el valor literal `"Indefinite"`.
11. **`authority`**: Autoridad emisora (Punto 4c / Vydal). Traducir al inglés (ej. `Prague City Hall`, `Municipality of Brno`, `Municipal Authority of Ostrava`) y **SIEMPRE** agregar el nombre del país al final en inglés: `, Czech Republic` (ej. `"Municipal Authority of Brno, Czech Republic"`).
12. **`class`**: Todas las categorías de licencias impresas en el **frente** (Punto 9), separadas por comas (ej. `"AM, A1, B, BE, T"`).
13. **`categoriesDates`**: Analizar la tabla del **reverso** (Columna 10 / 10. Platí od). Agrupar las categorías que compartan exactamente la misma fecha de validez inicial. Cada grupo debe ir en una **nueva línea** (`\n`). Ejemplo:
    ```text
    AM: 01 January 2000
    B1, B: 03 February 2001
    C1, C: 01 March 2002
    ```
14. **`classDescriptions`**: Descripción detallada de cada categoría poseída por el conductor. **Cada categoría debe comenzar en un nuevo renglón (`\n`)**.
    - Utilizar la lista oficial estandarizada de categorías de la República Checa / Unión Europea:
      - `AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.`
      - `A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.`
      - `A2 - motorcycles with a power rating under 35 kW.`
      - `A - heavy motorcycles without power restrictions.`
      - `B1 - quadricycles.`
      - `B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers.`
      - `BE - vehicle of category B towing a heavy trailer of under 3,500 kg.`
      - `C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers.`
      - `C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.`
      - `C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.`
      - `CE - vehicle of category C towing a heavy trailer.`
      - `D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.`
      - `D1E - vehicle of category D1 towing a heavy trailer.`
      - `D - passenger vehicles for more than eight passengers.`
      - `DE - vehicle of category D towing a heavy trailer.`
      - `T - Tractors and self-propelled agricultural or forestry machinery.`
      - `Code 10 - Limited to the operation of a specific vehicle type or under specific conditions.`
    - **CRÍTICO**: No incluir enlaces, URLs o fuentes tipo `"Source: https://..."`.
15. **`codes`**: Buscar en la esquina superior izquierda del **reverso** de la licencia o número de serie del documento. Extraer la serie alfanumérica / códigos.
16. **`explicacionCodigos`**: Interpretación de condiciones/restricciones (Columna 12 en reverso o frente / Harmonized European & National codes). Mapeo exacto:
    - Para Código `"01"` (o `"01.01"`, `"01.06"`): `"01- Correction of vision and/or eye protection (glasses/contact lenses)"`
    - Para Código `"70"`: `"70. Exchange of driver's license number"`
    - Para Código `"78"`: `"78- Restricted to vehicles with automatic transmission"`
    - Para Código `"95"`: `"95- Driver holding CPC (Certificate of Professional Competence)"`
    - Para restricciones Clase A1: `"Class A1- limited to 45 km/h"`
    - Para Código `"106"`: `"106- Operation of motor vehicles for the transport of passengers, with a maximum weight of 3,500 kilograms and more than 17 seats (including the driver’s seat)"`
    - Combinar todos los encontrados en un solo párrafo coherente. Si no hay ninguno, devolver un único guion `"-"`.
17. **`code106From`** y **`code106To`**: Extraer rango de fechas específicas únicamente si el código 106 está presente.
18. **`language`**: Idioma(s) detectados en la sección de la leyenda / reverso de la licencia (ej. `"Czech"` o `"Czech, English, French"`).

---

## Casos Especiales y Excepciones

- **Fechas**: Formato uniforme `DD Month YYYY` (ej. `04 July 2022`).
- **Fecha de expiración vacía**: Si el punto 4b estuviese en blanco, devolver `"Indefinite"`.
- **Nombres compuestos**: `firstName` toma exclusivamente la primera palabra, y `middleName` agrupa todas las palabras intermedias subsiguientes.
- **Sin URLs ni fuentes externas**: Ignorar cualquier referencia textual de enlaces web o notas al pie sobre normativas oficiales.
