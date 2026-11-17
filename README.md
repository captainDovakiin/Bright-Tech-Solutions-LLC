## Bright Tech Solutions

This is a prototype website of what it can be.

## Features

* Feature 1: Displays basic informatoin for the site.

## Getting Started

### Prerequisites

Only using HTML at this time.

### Installation


The site is plain HTML and CSS, hosted on Cloudflare Pages. Pushing to `main` on GitHub publishes it automatically.

## Quote form email

The "Book a consultation" form (`quote.html`) posts to `/api/quote`. That is a Cloudflare Pages Function in `functions/api/quote.js`, which sends the email through [Resend](https://resend.com):

- **To the company:** the full request goes to `consult@solutionswithbrighttech.com`. Hitting Reply answers the customer directly.
- **To the customer:** a branded "We received your request" confirmation.

The email templates are at the bottom of `functions/api/quote.js`. To change the wording or colors, edit them there and push.

### One-time setup

1. **Resend:** create an account, then go to **Domains → Add domain** and enter `send.solutionswithbrighttech.com`. Resend lists DNS records (MX, SPF/TXT and DKIM). Add each one in **Cloudflare → DNS** and wait for Resend to show the domain as *Verified*. Using the `send.` subdomain keeps these records separate from Microsoft 365's records on the main domain.
2. **Resend API key:** go to **API Keys → Create API key**, choose *Sending access*, and copy the key.
3. **Cloudflare Pages:** go to **Workers & Pages → Create → Pages → Connect to Git**, pick this GitHub repo, choose *None* for the framework preset, and leave the build command empty and the output directory as `/`.
4. **Secret:** in the Pages project, go to **Settings → Variables and Secrets** and add `RESEND_API_KEY` as a **Secret** with the key from step 2. Add it for Production (and Preview if you want preview links to send email too). Then redeploy.
5. **Custom domain:** in the Pages project, go to **Custom domains** and add `solutionswithbrighttech.com`.
6. **Test:** submit the form on the live site. Both emails should arrive within a minute.

Optional settings (same screen as the secret):

| Variable | Default | Purpose |
| --- | --- | --- |
| `QUOTE_TO` | `consult@solutionswithbrighttech.com` | Inbox that receives requests |
| `QUOTE_FROM` | `Bright Tech Solutions <quotes@send.solutionswithbrighttech.com>` | Sender address (must be on the verified domain) |
| `SEND_CONFIRMATION` | `true` | Set to `false` to turn off the customer confirmation email |

If the form shows an error, open the Pages project → **Functions → Real-time logs** (or Resend → **Logs**) to see why.
