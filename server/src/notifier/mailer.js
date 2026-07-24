// [WS2: poller-notifier] — see docs/workstreams/02-poller-notifier.md
//
// Email digest sender. One digest per subscription per poll, grouped by
// theatre, with local showtimes, ticketing links, and an unsubscribe footer.
// Transport is plain SMTP via nodemailer so any provider works.

import nodemailer from 'nodemailer';

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

/**
 * One-line description of the subscription's time-of-day window, or null when
 * it has none. Open-ended windows get "after"/"before" phrasing.
 */
function windowNote({ timeStart, timeEnd }) {
  // No trailing '.': the closing "a.m."/"p.m." already ends the sentence.
  if (timeStart && timeEnd) {
    return `Showing showtimes between ${formatWindowTime(timeStart)} and ${formatWindowTime(timeEnd)}`;
  }
  if (timeStart) return `Showing showtimes after ${formatWindowTime(timeStart)}`;
  if (timeEnd) return `Showing showtimes before ${formatWindowTime(timeEnd)}`;
  return null;
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
  lines.push(`You're receiving this because you subscribed to alerts for ${subscription.movieName}.`);
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);
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

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; max-width:600px; margin:0 auto; color:#1a1a1a;">
  <h2 style="margin:0 0 8px;">New showtimes for ${escapeHtml(subscription.movieName)}</h2>
  <p style="margin:0 0 8px; color:#444;">Times shown are local to each theatre.</p>
${note ? `  <p style="margin:0 0 8px; color:#444;">${escapeHtml(note)}</p>\n` : ''}  ${theatreBlocks}
  <hr style="margin:24px 0 12px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:12px; color:#888;">
    You're receiving this because you subscribed to alerts for
    ${escapeHtml(subscription.movieName)}.
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:#888;">Unsubscribe</a>
  </p>
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
    from: process.env.MAIL_FROM || 'Cineplex Alerts <alerts@example.com>',
    to: subscription.email,
    subject: `${n} new showtime${n === 1 ? '' : 's'} for ${subscription.movieName}`,
    text: renderText(subscription, groups, unsubscribeUrl),
    html: renderHtml(subscription, groups, unsubscribeUrl),
  });
}
