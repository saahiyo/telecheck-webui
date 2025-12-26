const input = `https://mega.nz/folder/ys5k1QqR#cYr3AFFI_RQnqgoE7HGSw
unknown, [17-12-2025 10:28 PM]
Maya, [17-12-2025 10:25 PM]
https://cloud.mail.ru/public/KV6j/nsyji24gQ/`;

console.log("Current Logic:");
const currentLinks = input.split(/[\n,\s]+/).map(l => l.trim()).filter(Boolean);
console.log(currentLinks);

console.log("\nProposed Logic:");
const urlRegex = /(https?:\/\/[^\s,]+|t\.me\/[^\s,]+)/g;
const proposedLinks = (input.match(urlRegex) || []).map(l => l.trim());
console.log(proposedLinks);
