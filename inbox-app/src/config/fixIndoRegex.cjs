const fs = require('fs');
let code = fs.readFileSync('countryPrompts.js', 'utf8');

// Regex that matches "If any field is missing..." at the end of the indonesia prompt
const regex = /If any field is missing or illegible, return an empty string \(""\)\. Return valid JSON matching the schema\./g;

const newIndoContent = `Respond ONLY with a valid JSON object matching the following schema:
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

code = code.replace(regex, newIndoContent);
fs.writeFileSync('countryPrompts.js', code);
console.log("Successfully replaced!");
