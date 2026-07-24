// [WS2: poller-notifier] — see docs/workstreams/02-poller-notifier.md

/**
 * TODO(WS2): implement with nodemailer over SMTP (env: SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, MAIL_FROM).
 *
 * sendNewShowingsEmail(subscription, sessions):
 * - one digest per call: subject like "3 new showtimes for The Odyssey"
 * - body grouped by theatre; each row: local date/time, experience types,
 *   auditorium, ticketing link
 * - footer unsubscribe link: `${PUBLIC_BASE_URL}/api/unsubscribe/${subscription.id}`
 * - plain-text alternative alongside HTML
 */
export async function sendNewShowingsEmail(_subscription, _sessions) {
  throw new Error('not implemented (WS2)');
}
