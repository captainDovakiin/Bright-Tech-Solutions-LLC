/**
 * POST /api/quote
 *
 * Cloudflare Pages Function that receives the "Book a consultation" form and
 * emails it to the company inbox through Resend (https://resend.com).
 *
 * Settings (Cloudflare dashboard → your Pages project → Settings → Variables and Secrets):
 *   RESEND_API_KEY     (required, add as a *Secret*)  API key from Resend
 *   QUOTE_TO           (optional)  inbox that receives requests
 *   QUOTE_FROM         (optional)  sender; must use a domain verified in Resend
 *   SEND_CONFIRMATION  (optional)  set to "false" to stop the customer auto-reply
 */

const DEFAULT_TO = "consult@solutionswithbrighttech.com";
const DEFAULT_FROM = "Bright Tech Solutions <quotes@send.solutionswithbrighttech.com>";
const COMPANY_EMAIL = "consult@solutionswithbrighttech.com";
const LOGO_PATH = "/Images/Bright_Tech_Solutions_Logo-removebg-preview.png";

// Brand palette (matches css/styles.css)
const C = {
  navy950: "#041427",
  navy: "#0b2e5c",
  blue: "#0a6fd1",
  cyan: "#22c7f0",
  paper: "#f4f8fc",
  tint: "#e8f4fd",
  line: "#d8e3ef",
  muted: "#4b6280",
};

const SERVICES = [
  "IT support and troubleshooting",
  "Networking and connectivity",
  "Technology security",
  "Cloud and technology solutions",
  "IT consulting and setup",
  "Something else",
];

const LIMITS = { name: 100, business: 150, email: 254, phone: 40, service: 100, details: 5000 };

export async function onRequestPost({ request, env }) {
  let input;
  try {
    const type = request.headers.get("content-type") || "";
    input = type.includes("application/json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return reply(400, "We couldn't read the form. Please try again.");
  }

  // Spam trap: the "website" field is hidden from people, so only bots fill it in.
  // Pretend it worked so the bot doesn't retry.
  if (clean(input.website)) return reply(200);

  const data = {};
  for (const [field, max] of Object.entries(LIMITS)) {
    data[field] = clean(input[field]).slice(0, max);
  }

  const missing = ["name", "business", "email", "service", "details"].filter((f) => !data[f]);
  if (missing.length) return reply(400, "Please fill in all required fields.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return reply(400, "Please enter a valid email address.");
  }
  if (!SERVICES.includes(data.service)) data.service = "Something else";

  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set for this Pages project.");
    return reply(500, "The form isn't set up yet. Please email us directly.");
  }

  const origin = new URL(request.url).origin;
  const logoUrl = origin + LOGO_PATH;
  const to = env.QUOTE_TO || DEFAULT_TO;
  const from = env.QUOTE_FROM || DEFAULT_FROM;

  // 1) Notify the company. This one has to succeed.
  const notify = await sendEmail(env.RESEND_API_KEY, {
    from,
    to: [to],
    reply_to: data.email,
    subject: `New quote: ${data.business} – ${data.service}`,
    html: companyEmailHtml(data, logoUrl, origin),
    text: companyEmailText(data),
  });

  if (!notify.ok) {
    console.error("Resend rejected the company email:", notify.status, await notify.text());
    return reply(502, "We couldn't send your request right now.");
  }

  // 2) Thank-you email to the customer. If this fails we still report success,
  //    because the company already has the request.
  if (env.SEND_CONFIRMATION !== "false") {
    const confirm = await sendEmail(env.RESEND_API_KEY, {
      from,
      to: [data.email],
      reply_to: to,
      subject: "We received your consultation request",
      html: customerEmailHtml(data, logoUrl, origin),
      text: customerEmailText(data),
    });
    if (!confirm.ok) {
      console.error("Resend rejected the confirmation email:", confirm.status, await confirm.text());
    }
  }

  return reply(200);
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

function sendEmail(apiKey, message) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
}

function reply(status, message) {
  return Response.json(
    status === 200 ? { success: true } : { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape, then keep the customer's line breaks.
function paragraph(value) {
  return esc(value).replace(/\r?\n/g, "<br>");
}

function telHref(phone) {
  return "tel:" + phone.replace(/[^\d+]/g, "");
}

/* ------------------------------------------------------------------------ */
/* Email templates                                                           */
/* Emails use tables and inline styles because Outlook ignores most modern   */
/* CSS. Edit the wording and colors freely; keep the structure.              */
/* ------------------------------------------------------------------------ */

const FONT = "'Segoe UI', Helvetica, Arial, sans-serif";

function layout({ preheader, logoUrl, origin, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Bright Tech Solutions</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${C.line};border-radius:16px;overflow:hidden;">
      <tr><td style="background:${C.navy950};padding:22px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="background:#ffffff;border-radius:10px;padding:6px;"><img src="${esc(logoUrl)}" width="36" height="36" alt="Bright Tech Solutions" style="display:block;border:0;"></td>
          <td style="padding-left:12px;font-family:${FONT};font-size:18px;font-weight:700;color:#ffffff;">Bright <span style="color:${C.cyan};">Tech</span> Solutions</td>
        </tr></table>
      </td></tr>
      <tr><td style="height:4px;background:${C.blue};line-height:4px;font-size:0;">&nbsp;</td></tr>
      ${body}
      <tr><td style="padding:20px 32px;border-top:1px solid ${C.line};font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">
        Bright Tech Solutions LLC &middot; <a href="mailto:${COMPANY_EMAIL}" style="color:${C.blue};text-decoration:none;">${COMPANY_EMAIL}</a> &middot; <a href="${esc(origin)}" style="color:${C.blue};text-decoration:none;">${esc(origin.replace(/^https?:\/\//, ""))}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function row(label, valueHtml) {
  return `<tr>
    <td valign="top" style="padding:10px 0;border-bottom:1px solid ${C.line};width:130px;font-family:${FONT};font-size:13px;color:${C.muted};">${label}</td>
    <td valign="top" style="padding:10px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:15px;color:${C.navy};">${valueHtml}</td>
  </tr>`;
}

function companyEmailHtml(d, logoUrl, origin) {
  const link = `color:${C.blue};text-decoration:none;`;
  const body = `
      <tr><td style="padding:32px 32px 8px;font-family:${FONT};">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.blue};font-weight:700;">New consultation request</p>
        <h1 style="margin:0;font-size:24px;line-height:30px;color:${C.navy};">${esc(d.business)}</h1>
        <p style="margin:6px 0 0;font-size:15px;color:${C.muted};">${esc(d.service)}</p>
      </td></tr>
      <tr><td style="padding:16px 32px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row("Name", esc(d.name))}
          ${row("Email", `<a href="mailto:${esc(d.email)}" style="${link}">${esc(d.email)}</a>`)}
          ${row("Phone", d.phone ? `<a href="${esc(telHref(d.phone))}" style="${link}">${esc(d.phone)}</a>` : `<span style="color:${C.muted};">Not provided</span>`)}
          ${row("Service", esc(d.service))}
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px 8px;font-family:${FONT};">
        <p style="margin:0 0 8px;font-size:13px;color:${C.muted};">Their needs</p>
        <div style="background:${C.tint};border-left:4px solid ${C.cyan};padding:16px 18px;font-size:15px;line-height:23px;color:${C.navy};">${paragraph(d.details)}</div>
      </td></tr>
      <tr><td style="padding:20px 32px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${C.blue};border-radius:999px;"><a href="mailto:${esc(d.email)}?subject=${encodeURIComponent("Re: Your consultation request")}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Reply to ${esc(d.name)}</a></td>
        </tr></table>
      </td></tr>`;
  return layout({
    preheader: `${d.name} from ${d.business} needs help with ${d.service}.`,
    logoUrl,
    origin,
    body,
  });
}

function companyEmailText(d) {
  return [
    "NEW CONSULTATION REQUEST",
    "",
    `Business: ${d.business}`,
    `Name:     ${d.name}`,
    `Email:    ${d.email}`,
    `Phone:    ${d.phone || "Not provided"}`,
    `Service:  ${d.service}`,
    "",
    "Their needs:",
    d.details,
    "",
    "Reply to this email to respond to the customer directly.",
  ].join("\n");
}

function customerEmailHtml(d, logoUrl, origin) {
  const step = (n, title, text) => `<tr>
      <td valign="top" style="padding:8px 14px 8px 0;width:30px;">
        <div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:${C.blue};color:#ffffff;text-align:center;font-family:${FONT};font-size:14px;font-weight:700;">${n}</div>
      </td>
      <td valign="top" style="padding:8px 0;font-family:${FONT};">
        <div style="font-size:15px;font-weight:700;color:${C.navy};">${title}</div>
        <div style="font-size:14px;color:${C.muted};">${text}</div>
      </td>
    </tr>`;
  const body = `
      <tr><td style="padding:32px 32px 8px;font-family:${FONT};">
        <h1 style="margin:0 0 12px;font-size:24px;line-height:30px;color:${C.navy};">Thanks, ${esc(d.name)}!</h1>
        <p style="margin:0;font-size:15px;line-height:24px;color:${C.navy};">We received your consultation request for <strong>${esc(d.business)}</strong>. Someone from our team will review it and get back to you, usually within one business day.</p>
      </td></tr>
      <tr><td style="padding:20px 32px 4px;font-family:${FONT};">
        <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:${C.navy};">What happens next</p>
        <table role="presentation" cellpadding="0" cellspacing="0">
          ${step(1, "We review your request", "We read through your needs and goals.")}
          ${step(2, "We reach out", "A quick follow-up to ask any questions.")}
          ${step(3, "You get a clear quote", "A practical recommendation with no jargon.")}
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px 8px;font-family:${FONT};">
        <p style="margin:0 0 8px;font-size:13px;color:${C.muted};">What you sent us &middot; ${esc(d.service)}</p>
        <div style="background:${C.tint};border-left:4px solid ${C.cyan};padding:16px 18px;font-size:15px;line-height:23px;color:${C.navy};">${paragraph(d.details)}</div>
      </td></tr>
      <tr><td style="padding:16px 32px 32px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.navy};">
        Need to add something? Just reply to this email.<br><br>
        &mdash; The Bright Tech Solutions team
      </td></tr>`;
  return layout({
    preheader: "We received your request and will be in touch soon.",
    logoUrl,
    origin,
    body,
  });
}

function customerEmailText(d) {
  return [
    `Thanks, ${d.name}!`,
    "",
    `We received your consultation request for ${d.business}. Someone from our team will review it and get back to you, usually within one business day.`,
    "",
    "What happens next:",
    "1. We review your request",
    "2. We reach out with any questions",
    "3. You get a clear quote",
    "",
    `What you sent us (${d.service}):`,
    d.details,
    "",
    "Need to add something? Just reply to this email.",
    "",
    "- The Bright Tech Solutions team",
  ].join("\n");
}
