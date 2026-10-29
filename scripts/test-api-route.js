async function test() {
  const res = await fetch('https://telecheck.vercel.app/api/?async=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ links: ['https://t.me/1'] })
  });
  console.log('Status:', res.status);
  console.log(await res.text());
}
test();
