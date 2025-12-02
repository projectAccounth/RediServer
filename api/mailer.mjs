import https from 'https';
import nodemailer from 'nodemailer';

const DISCORD_WEBHOOK_URL = `https://discord.com/api/webhooks/1439653966286946337/${process.env.WEBHOOK_TOKEN}`;

function sendDiscordWebhook(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData);
        } else {
          reject(new Error(`HTTP Status: ${res.statusCode}, Response: ${responseData}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = req.body;

  const discordPayload = {};
  if (body.content) {
    let content = String(body.content);
    if (content.length > 2000) content = content.slice(0, 2000);
    discordPayload.content = content;
  }
  if (body.username) discordPayload.username = String(body.username);
  if (body.avatar_url) discordPayload.avatar_url = String(body.avatar_url);
  if (body.tts !== undefined) discordPayload.tts = Boolean(body.tts);
  if (Array.isArray(body.embeds)) discordPayload.embeds = body.embeds.slice(0, 10);
  if (body.allowed_mentions && typeof body.allowed_mentions === 'object') {
    discordPayload.allowed_mentions = body.allowed_mentions;
  }

  if (!discordPayload.content && !discordPayload.embeds) {
    return res.status(400).json({ success: false, error: "Payload must contain content or embeds" });
  }

  try {
    await sendDiscordWebhook(DISCORD_WEBHOOK_URL, discordPayload);

    if (body.sendEmail && body.email && body.email.subject && body.email.text) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS, // app password
        },
      });

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: body.email.to || process.env.SMTP_USER, // fallback
        subject: body.email.subject,
        text: body.email.text,
        html: body.email.html,
      };

      await transporter.sendMail(mailOptions);
    }

    res.status(200).json({ success: true, message: "Discord and email sent successfully" });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
