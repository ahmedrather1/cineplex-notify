// [WS2: poller-notifier] — see docs/workstreams/02-poller-notifier.md
//
// Email digest sender. One digest per subscription per poll, grouped by
// theatre, with local showtimes, ticketing links, and an unsubscribe footer.
// Transport is plain SMTP via nodemailer so any provider works.

import nodemailer from 'nodemailer';

// Non-affiliation notice, mirrored in the site footer (client App.jsx).
const DISCLAIMER =
  'Marquee is an independent service, not affiliated with, endorsed by, or ' +
  'sponsored by Cineplex Entertainment Inc. Showtime and movie data come from ' +
  'publicly available Cineplex listings; all trademarks belong to their ' +
  'respective owners.';

let transport = null;

/** Lazy singleton SMTP transport from env. Empty SMTP_USER ⇒ no auth. */
function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port,
      secure: port === 465, // implicit TLS only on 465; otherwise plain/STARTTLS
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transport;
}

/**
 * Format Cineplex's timezone-less local datetime ("2026-07-24T11:00:00")
 * for display without shifting it into the server's timezone.
 */
function formatLocal(showStartDateTime) {
  const d = new Date(`${showStartDateTime}Z`); // pin the wall-clock time as UTC…
  return d.toLocaleString('en-CA', {
    timeZone: 'UTC', // …and read it back in UTC, so it stays theatre-local
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Format an 'HH:MM' 24h bound as e.g. "5:00 p.m." for email copy. */
function formatWindowTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}

/** One window as email copy: "12:00 p.m. – 5:00 p.m.", "after 5:00 p.m.", "before 9:00 p.m." */
function describeWindow({ start, end }) {
  if (start && end) return `${formatWindowTime(start)} – ${formatWindowTime(end)}`;
  if (start) return `after ${formatWindowTime(start)}`;
  if (end) return `before ${formatWindowTime(end)}`;
  return null; // both bounds absent — the API rejects these; skip defensively
}

/** Format a 'YYYY-MM-DD' bound as e.g. "Aug 1" without timezone shifting. */
function formatWindowDate(iso) {
  const [, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}`;
}

/** Date-range phrase: "between Aug 1 and Aug 15", "on Aug 1", "from Aug 1", "until Aug 15". */
function describeDateRange({ dateStart, dateEnd }) {
  if (dateStart && dateEnd) {
    return dateStart === dateEnd
      ? `on ${formatWindowDate(dateStart)}`
      : `between ${formatWindowDate(dateStart)} and ${formatWindowDate(dateEnd)}`;
  }
  if (dateStart) return `from ${formatWindowDate(dateStart)}`;
  if (dateEnd) return `until ${formatWindowDate(dateEnd)}`;
  return null;
}

/**
 * One-line description of the subscription's time-of-day windows (match ANY)
 * and/or date range, or null when it has neither. Examples:
 *   "Showing showtimes: 12:00 p.m. – 5:00 p.m., or 9:00 p.m. – 2:00 a.m."
 *   "Showing showtimes between Aug 1 and Aug 15."
 *   "Showing showtimes: after 5:00 p.m., from Aug 1."
 */
function windowNote({ timeWindows, dateStart, dateEnd }) {
  const times = (timeWindows ?? []).map(describeWindow).filter(Boolean);
  const dates = describeDateRange({ dateStart, dateEnd });
  let note = null;
  if (times.length) {
    note = `Showing showtimes: ${times.join(', or ')}${dates ? `, ${dates}` : ''}`;
  } else if (dates) {
    note = `Showing showtimes ${dates}`;
  }
  // End with exactly one period ("p.m." already carries its own).
  return note && !note.endsWith('.') ? `${note}.` : note;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Group sessions by theatre, sessions sorted by start time within each. */
function groupByTheatre(sessions) {
  const byTheatre = new Map();
  for (const s of sessions) {
    if (!byTheatre.has(s.theatreId)) {
      byTheatre.set(s.theatreId, { theatreName: s.theatreName, sessions: [] });
    }
    byTheatre.get(s.theatreId).sessions.push(s);
  }
  for (const group of byTheatre.values()) {
    group.sessions.sort((a, b) =>
      a.showStartDateTime < b.showStartDateTime ? -1 : 1
    );
  }
  return [...byTheatre.values()].sort((a, b) =>
    a.theatreName.localeCompare(b.theatreName)
  );
}

function renderText(subscription, groups, unsubscribeUrl) {
  const lines = [`New showtimes for ${subscription.movieName}:`, ''];
  const note = windowNote(subscription);
  if (note) {
    lines.push(note, '');
  }
  for (const g of groups) {
    lines.push(g.theatreName);
    for (const s of g.sessions) {
      const exp = s.experienceTypes?.length ? ` [${s.experienceTypes.join(', ')}]` : '';
      const aud = s.auditorium ? ` — ${s.auditorium}` : '';
      const sold = s.isSoldOut ? ' (SOLD OUT)' : '';
      lines.push(`  * ${formatLocal(s.showStartDateTime)}${exp}${aud}${sold}`);
      if (s.ticketingUrl) lines.push(`    Get tickets: ${s.ticketingUrl}`);
    }
    lines.push('');
  }
  lines.push('--');
  lines.push(`You're receiving this because you subscribed to Marquee alerts for ${subscription.movieName}.`);
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);
  const donateUrl = (process.env.DONATE_URL || '').trim();
  if (donateUrl) {
    lines.push(`Marquee is free — if it's useful, you can help cover hosting costs: ${donateUrl}`);
  }
  lines.push('');
  lines.push(DISCLAIMER);
  return lines.join('\n');
}

function renderHtml(subscription, groups, unsubscribeUrl) {
  const note = windowNote(subscription);
  const theatreBlocks = groups
    .map((g) => {
      const rows = g.sessions
        .map((s) => {
          const exp = s.experienceTypes?.length
            ? `<span style="color:#666;">${escapeHtml(s.experienceTypes.join(', '))}</span>`
            : '';
          const aud = s.auditorium
            ? `<span style="color:#666;">${escapeHtml(s.auditorium)}</span>`
            : '';
          const sold = s.isSoldOut
            ? '<strong style="color:#b00020;">Sold out</strong>'
            : s.ticketingUrl
              ? `<a href="${escapeHtml(s.ticketingUrl)}">Get tickets</a>`
              : '';
          const meta = [exp, aud, sold].filter(Boolean).join(' &middot; ');
          return `<li style="margin:4px 0;"><strong>${escapeHtml(
            formatLocal(s.showStartDateTime)
          )}</strong>${meta ? ` &mdash; ${meta}` : ''}</li>`;
        })
        .join('\n');
      return `<h3 style="margin:16px 0 4px;">${escapeHtml(g.theatreName)}</h3>
<ul style="margin:4px 0; padding-left:20px;">
${rows}
</ul>`;
    })
    .join('\n');

  const donateUrl = (process.env.DONATE_URL || '').trim();
  const supportBlock = donateUrl
    ? `\n  <p style="font-size:12px; color:#888; margin-top:8px;">Marquee is free — if it's useful, you can <a href="${escapeHtml(donateUrl)}" style="color:#888;">help cover hosting costs</a>.</p>`
    : '';

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; max-width:600px; margin:0 auto; color:#1a1a1a;">
  <h2 style="margin:0 0 8px;">New showtimes for ${escapeHtml(subscription.movieName)}</h2>
  <p style="margin:0 0 8px; color:#444;">Times shown are local to each theatre.</p>
${note ? `  <p style="margin:0 0 8px; color:#444;">${escapeHtml(note)}</p>\n` : ''}  ${theatreBlocks}
  <hr style="margin:24px 0 12px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:12px; color:#888;">
    You're receiving this because you subscribed to Marquee alerts for
    ${escapeHtml(subscription.movieName)}.
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:#888;">Unsubscribe</a>
  </p>${supportBlock}
  <p style="font-size:11px; color:#aaa; margin-top:8px;">${escapeHtml(DISCLAIMER)}</p>
</div>`;
}

/**
 * Send one digest email listing the new sessions for a subscription.
 * @param {{id: string, email: string, movieName: string}} subscription
 * @param {Array<object>} sessions flattened sessions (see cineplex.js#flattenSessions)
 */
export async function sendNewShowingsEmail(subscription, sessions) {
  const baseUrl = (process.env.PUBLIC_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${subscription.id}`;
  const groups = groupByTheatre(sessions);
  const n = sessions.length;

  await getTransport().sendMail({
    from: process.env.MAIL_FROM || 'Marquee <alerts@example.com>',
    to: subscription.email,
    subject: `${n} new showtime${n === 1 ? '' : 's'} for ${subscription.movieName}`,
    text: renderText(subscription, groups, unsubscribeUrl),
    html: renderHtml(subscription, groups, unsubscribeUrl),
  });
}
