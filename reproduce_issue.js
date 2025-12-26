const input = `https://t.me/link1
https://t.me/link2 https://t.me/link3`;

console.log("Current Logic:");
const currentLinks = input.split(/[\n,\s]+/).map(l => l.trim()).filter(Boolean);
console.log(currentLinks);

console.log("\nProposed Logic:");
const proposedLinks = input.split(/[\n,\s]+/).map(l => l.trim()).filter(Boolean);
console.log(proposedLinks);
