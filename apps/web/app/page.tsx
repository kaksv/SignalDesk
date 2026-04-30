export default function HomePage() {
  return (
    <main style={{ fontFamily: "Inter, sans-serif", margin: "3rem auto", maxWidth: 800 }}>
      <h1>SignalDesk</h1>
      <p>
        Institutional prediction markets on Canton. This is the starter UI for the MVP.
      </p>
      <ul>
        <li>Phase 1: Market listing and creation</li>
        <li>Phase 2: Trade ticket and position panel</li>
        <li>Phase 3: Settlement and payout dashboard</li>
      </ul>
    </main>
  );
}
