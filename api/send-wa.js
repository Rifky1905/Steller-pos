// Vercel Serverless Function — proxy aman ke Fonnte WhatsApp Gateway.
// Token FONNTE_TOKEN disimpan di env server (BUKAN VITE_*) sehingga tidak
// terekspos ke bundle frontend / source JS pengunjung.
//
// Frontend memanggil: POST /api/send-wa { target: "62xxx", message: "..." }
// Di Vercel → Settings → Environment Variables, isi: FONNTE_TOKEN=<token fonnte>

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { target, message } = req.body || {}
  const digits = String(target || '').replace(/\D/g, '')

  // Validasi dasar: nomor internasional 9-16 digit, pesan 1-4000 karakter
  if (digits.length < 9 || digits.length > 16) {
    return res.status(400).json({ status: false, reason: 'Nomor target tidak valid' })
  }
  if (!message || typeof message !== 'string' || message.length > 4000) {
    return res.status(400).json({ status: false, reason: 'Pesan tidak valid' })
  }

  const token = (process.env.FONNTE_TOKEN || '').trim()
  if (!token) {
    return res.status(500).json({
      status: false,
      reason: 'FONNTE_TOKEN belum diset di Vercel Environment Variables',
    })
  }

  try {
    const r = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: new URLSearchParams({ target: digits, message }),
    })
    const json = await r.json().catch(() => ({}))
    return res.status(r.ok && json.status === true ? 200 : 502).json(json)
  } catch (e) {
    return res.status(502).json({ status: false, reason: 'Tidak dapat terhubung ke Fonnte: ' + e.message })
  }
}
