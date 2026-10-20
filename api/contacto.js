const DESTINO = 'sergio@newpatt.com';
const REMITENTE = { name: 'Web sergiomora.tech', email: 'sergio@newpatt.com' };
const ORIGEN = 'sergiomora.tech';

const esc = (s) =>
  String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  // Trampa anti-spam: los bots rellenan este campo oculto, las personas no.
  if (String(b.website || '').trim()) return res.status(200).json({ ok: true });

  for (const campo of ['nombre', 'email', 'empresa', 'mensaje']) {
    if (!String(b[campo] || '').trim()) {
      return res.status(400).json({ ok: false, error: 'Falta un campo obligatorio.' });
    }
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email).trim())) {
    return res.status(400).json({ ok: false, error: 'Revisa el email, no parece válido.' });
  }

  const key = process.env.BREVO_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: 'El formulario no está configurado todavía.' });

  const filas = [
    ['Nombre', b.nombre],
    ['Email', b.email],
    ['Empresa', b.empresa],
    ['Web', b.web || 'No indicada'],
    ['Necesita', b.necesita || 'No indicado'],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 16px;border-bottom:1px solid #eceaf2;color:#6b6780;font-size:13px;white-space:nowrap">${esc(k)}</td>` +
        `<td style="padding:10px 16px;border-bottom:1px solid #eceaf2;color:#15121f;font-size:15px;font-weight:600">${esc(v)}</td></tr>`
    )
    .join('');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f4f8;padding:28px">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
<div style="background:#04030C;padding:22px 26px">
<div style="color:#FFDE59;font-size:11px;letter-spacing:.14em;text-transform:uppercase">Nuevo contacto</div>
<div style="color:#fff;font-size:20px;font-weight:700;margin-top:6px">${esc(b.empresa)}</div>
<div style="color:#68A7BE;font-size:13px;margin-top:4px">Desde ${ORIGEN}</div>
</div>
<table style="width:100%;border-collapse:collapse">${filas}</table>
<div style="padding:18px 26px">
<div style="color:#6b6780;font-size:13px;margin-bottom:8px">Su caso</div>
<div style="color:#15121f;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(b.mensaje)}</div>
</div>
<div style="padding:0 26px 24px">
<a href="mailto:${esc(b.email)}" style="display:inline-block;background:#FFDE59;color:#04030C;font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:999px">Responder a ${esc(b.nombre)}</a>
</div>
</div></div>`;

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: REMITENTE,
        to: [{ email: DESTINO }],
        replyTo: { email: String(b.email).trim(), name: String(b.nombre).trim() },
        subject: `Nuevo contacto web · ${String(b.empresa).trim()}`,
        htmlContent: html,
      }),
    });

    if (!r.ok) {
      const detalle = await r.text();
      console.error('Brevo error', r.status, detalle);
      return res.status(502).json({ ok: false, error: 'No se pudo enviar. Inténtalo de nuevo en un minuto.' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Error de red', e);
    return res.status(502).json({ ok: false, error: 'No se pudo enviar. Inténtalo de nuevo en un minuto.' });
  }
};
