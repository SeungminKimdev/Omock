export default function HeaderBar({ turnLabel }: { turnLabel: string }) {
  return (
    <header>
      <div className="brand" aria-hidden="true">
        <div className="logo" aria-hidden="true"></div>
        <div>
          <h1>Gomoku — Blue Glass Edition</h1>
          <div className="sub">Calm, modern, and focused on clarity</div>
        </div>
      </div>
      <div className="controls" aria-label="Game controls">
        {/* Buttons are provided by Controls component */}
        <div className="pill" aria-live="polite">{turnLabel}</div>
      </div>
    </header>
  )
}
