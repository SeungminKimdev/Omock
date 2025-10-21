// src/components/Sidebar.tsx
import { useGameStore } from '@/store/gameStore'

export default function Sidebar() {
  const { game, role, connection } = useGameStore()
  const boardLabel = `${game.size} × ${game.size}`
  const winLabel = `${game.winLen} in a row`
  const statusLabel =
    connection === 'open'
      ? `Online${role ? ` · You: ${role}` : ''}`
      : connection === 'connecting'
      ? 'Connecting…'
      : 'Offline'

  return (
    // 바깥에서 already <aside className="side">로 감쌈 (App.tsx)
    <div aria-label="Game info">
      <div className="row">
        <div className="legend">
          <div className="stone-demo stone-b" /> Black
        </div>
        <div className="legend">
          <div className="stone-demo stone-w" /> White
        </div>
      </div>

      <div className="row">
        <div>Board</div>
        <div className="pill">{boardLabel}</div>
      </div>

      <div className="row">
        <div>Win</div>
        <div className="pill">{winLabel}</div>
      </div>

      <div className="row">
        <div>Status</div>
        <div className="pill">{statusLabel}</div>
      </div>

      <div className="row">
        <div>Shortcuts</div>
        <div className="hint">
          <span className="kbd">Z</span> Undo &nbsp; <span className="kbd">Y</span> Redo &nbsp;{' '}
          <span className="kbd">N</span> New
        </div>
      </div>

      <div className="hint">
        Tip: hover a cell to preview; click/tap to place a stone. Smooth animations keep things
        elegant and readable. ✔️
      </div>
    </div>
  )
}
