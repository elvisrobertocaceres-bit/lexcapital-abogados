// Cloudflare Worker — proxy seguro hacia HubSpot Contacts API
// El token se inyecta como secret de entorno (HS_TOKEN), nunca en el código.
const HS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

export default {
  async fetch(request, env) {
    const TOKEN = env.HS_TOKEN;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const properties = {
      firstname: body.firstname || '',
      lastname:  body.lastname  || '',
      email:     body.email     || '',
      phone:     body.phone     || '',
      message:   body.message   || '',
    };

    // Verificar si el contacto ya existe por email para no duplicar
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
      // Actualizar contacto existente
      hsRes = await fetch(`${HS_URL}/${contactId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties }),
      });
    } else {
      // Crear contacto nuevo
      hsRes = await fetch(HS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties }),
      });
    }

    const hsData = await hsRes.json();

    if (!hsRes.ok) {
      return new Response(JSON.stringify({ ok: false, error: hsData }), {
        status: hsRes.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: hsData.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  },
};
