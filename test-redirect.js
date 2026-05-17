async function test() {
  const res = await fetch('https://telecheck.vercel.app//?async=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ links: ['https://t.me/1', 'https://t.me/2', 'https://t.me/3'] }),
    redirect: 'follow'
  });
  console.log('Status:', res.status);
  console.log(await res.text());
}
test();
