const fs = require('fs');
let code = fs.readFileSync('countryPrompts.js', 'utf8');
const oldIndo = '17. "explicacionCodigos": Provide a professional English translation describing the allowed driving categories if possible.\n\nIf any field is missing or illegible, return an empty string (""). Return valid JSON matching the schema.';
const newIndo = `17. "explicacionCodigos": Provide a professional English translation describing the allowed driving categories if possible.

Respond ONLY with a valid JSON object matching the following schema:
{
  "surname": "...",
  "firstName": "...",
  "middleName": "...",
  "firstNames": "...",
  "fullName": "...",
  "dateOfBirth": "...",
  "placeOfBirth": "...",
  "blood": "...",
  "gender": "...",
  "address": "...",
  "issueDate": "...",
  "expiryDate": "...",
  "licenseNumber": "...",
  "authority": "...",
  "class": "...",
  "code": "...",
  "explicacionCodigos": "..."
}

If any field is missing or illegible, return an empty string ("").`;
code = code.replace(oldIndo, newIndo);
fs.writeFileSync('countryPrompts.js', code);
console.log("Replaced Indonesia successfully");
