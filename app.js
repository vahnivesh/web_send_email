import "dotenv/config";
import http from "http";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL; // e.g. noreply@yourdomain.com
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Zync';

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/send-password-email') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let toEmail, password;
      try {
        ({ toEmail, password } = JSON.parse(body));
      } catch {
        res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return;
      }

      if (!toEmail || !password || !toEmail.includes('@')) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid input' })); return;
      }

      try {
        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': BREVO_API_KEY
          },
          body: JSON.stringify({
            sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
            to: [{ email: toEmail }],
            subject: '🔐 Your Zync Backup Password',
            htmlContent: `
              <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f5f3ff;border-radius:16px;">
                <div style="text-align:center;margin-bottom:24px;">
                  <span style="font-family:sans-serif;font-size:36px;font-weight:900;color:#1e1333;letter-spacing:0.08em;">Zync</span>
                </div>
                <h2 style="color:#1e1333;font-size:20px;margin-bottom:8px;">Your Backup Password</h2>
                <p style="color:#555;font-size:14px;margin-bottom:20px;">You exported your Zync account. Here is your encryption password — keep it safe:</p>
                <div style="background:#1e1333;color:#a78bfa;font-family:monospace;font-size:24px;font-weight:700;padding:20px 24px;border-radius:12px;text-align:center;letter-spacing:0.1em;">${password}</div>
                <p style="color:#888;font-size:11px;margin-top:20px;line-height:1.5;">
                  ⚠️ Without this password, your backup <strong>cannot be decrypted</strong>.<br>
                  Zync does not store your password, email, or any of your data on any server.
                </p>
              </div>
            `
          })
        });

        // Discard toEmail and password immediately after sending — not logged, not stored
        toEmail = null;
        password = null;

        if (brevoRes.ok) {
          res.writeHead(200); res.end(JSON.stringify({ ok: true }));
        } else {
          const errText = await brevoRes.text();
          console.error('Brevo error:', brevoRes.status);
          res.writeHead(502); res.end(JSON.stringify({ error: 'Brevo error' }));
        }
      } catch(e) {
        console.error('Send failed:', e.message);
        res.writeHead(500); res.end(JSON.stringify({ error: 'Server error' }));
      }
    });
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200); res.end(JSON.stringify({ status: 'Zync email server running' }));
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Zync email server ready on port', process.env.PORT || 3000);
});
