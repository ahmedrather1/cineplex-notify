#!/usr/bin/env node
// [WS2: poller-notifier] Dev-only SMTP sink (Mailpit stand-in — no Docker needed).
//
// Listens on localhost:1025 (override with SINK_PORT), accepts any mail
// without auth or TLS, and logs from/to/subject + a body excerpt to stdout.
// Set SINK_FILE=/path/to/log to also append each full raw message there.
//
//   node server/src/notifier/dev-smtp-sink.mjs
//
// Never run in production; it accepts and discards everything.

import { SMTPServer } from 'smtp-server';
import { appendFileSync } from 'node:fs';

const port = Number(process.env.SINK_PORT || 1025);

function summarize(raw) {
  const headerEnd = raw.indexOf('\r\n\r\n');
  const headers = headerEnd === -1 ? raw : raw.slice(0, headerEnd);
  const body = headerEnd === -1 ? '' : raw.slice(headerEnd + 4);
  const header = (name) => {
    // Unfold continuation lines, then match the header.
    const m = headers.replace(/\r\n[ \t]+/g, ' ').match(new RegExp(`^${name}: (.*)$`, 'im'));
    return m ? m[1] : '';
  };
  return {
    from: header('From'),
    to: header('To'),
    subject: header('Subject'),
    bodyExcerpt: body.slice(0, 600),
  };
}

const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ['AUTH', 'STARTTLS'],
  onData(stream, session, callback) {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const { from, to, subject, bodyExcerpt } = summarize(raw);
      console.log(
        [
          '=== message received ' + new Date().toISOString() + ' ===',
          `envelope: ${session.envelope.mailFrom?.address} -> ${session.envelope.rcptTo.map((r) => r.address).join(', ')}`,
          `From: ${from}`,
          `To: ${to}`,
          `Subject: ${subject}`,
          '--- body excerpt ---',
          bodyExcerpt,
          '=== end message ===',
        ].join('\n')
      );
      if (process.env.SINK_FILE) {
        appendFileSync(
          process.env.SINK_FILE,
          `\n=== ${new Date().toISOString()} ===\n${raw}\n`
        );
      }
      callback();
    });
  },
});

server.on('error', (err) => console.error(`[smtp-sink] ${err.message}`));
server.listen(port, '127.0.0.1', () =>
  console.log(`[smtp-sink] listening on 127.0.0.1:${port}`)
);
