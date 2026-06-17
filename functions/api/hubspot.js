// Cloudflare Pages Function — proxy seguro hacia HubSpot Contacts API
// HS_TOKEN se configura como variable de entorno en el dashboard de Cloudflare Pages
const HS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const TOKEN = env.HS_TOKEN;
  if (!TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: 'Token no configurado' }), { status: 500, headers: CORS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS });
  }

  const properties = {
    firstname: body.firstname || '',
    lastname:  body.lastname  || '',
    email:     body.email     || '',
    phone:     body.phone     || '',
    message:   body.message   || '',
    ...(body.adclid ? { hs_analytics_last_url: body.adclid } : {}),
  };

  // Verificar si el contacto ya existe por email
  let contactId = null;
  if (properties.email) {
    const search = await fetch(
      `${HS_URL}/${encodeURIComponent(properties.email)}?idProperty=email`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (search.ok) {
      const existing = await search.json();
      contactId = existing.id;
    }
  }

  let hsRes;
  if (contactId) {
    hsRes = await fetch(`${HS_URL}/${contactId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties }),
    });
  } else {
    hsRes = await fetch(HS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties }),
    });
  }

  const hsData = await hsRes.json();

  if (!hsRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: hsData }), { status: hsRes.status, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, id: hsData.id }), { status: 200, headers: CORS });
}
