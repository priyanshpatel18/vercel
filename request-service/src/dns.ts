export async function createSubdomain(subdomain: string) {
  const API_KEY = process.env.GODADDY_KEY!;
  const API_SECRET = process.env.GODADDY_SECRET!;
  const DOMAIN = process.env.GODADDY_DOMAIN!;
  const IP = process.env.PUBLIC_IP!;

  const url = `https://api.godaddy.com/v1/domains/${DOMAIN}/records/A/${subdomain}`;
  const body = [{ data: IP, ttl: 600 }];

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `sso-key ${API_KEY}:${API_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create GoDaddy DNS: ${text}`);
  }

  console.log(`DNS created: ${subdomain}.${DOMAIN} → ${IP}`);
}
