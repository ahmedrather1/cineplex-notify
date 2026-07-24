// [WS3: client-ui] — see docs/workstreams/03-client-ui.md
// Owns everything under client/. Build the subscribe flow:
//   1. searchable movie picker (poster grid or list; fetchMovies)
//   2. theatre multi-select with text filter by name/city (fetchTheatres)
//   3. email input + submit (createSubscription) → success state with
//      "you'll get an email when new showtimes appear" + mention of the
//      unsubscribe link in every email
// No accounts, no passwords, nothing stored in the browser beyond the form.

export default function App() {
  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Cineplex Showtime Alerts</h1>
      <p>
        Pick a movie and your theatres, leave an email, and get notified when
        new showtimes are released.
      </p>
      <p style={{ color: '#888' }}>UI not implemented yet — see docs/workstreams/03-client-ui.md (WS3).</p>
    </main>
  );
}
