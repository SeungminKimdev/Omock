import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'

const CFG = {
  bgTop: '#0e274b', bgBottom: '#0a1e3d', starRadius: 3.2,
  stone: { radius: 0.44, glossy: true, dropMs: 220, removeMs: 180, shadow: true },
  ripple: { enabled: true, dur: 420 },
  hover: { color: 'rgba(141, 198, 255, 0.25)', outline: 'rgba(141, 198, 255, 0.8)' },
}

function cssVar(name: string){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim() }
function dpr(){ return Math.min(2.5, window.devicePixelRatio || 1) }
function clamp(v:number,a:number,b:number){ return Math.max(a, Math.min(b,v)) }

export default function BoardCanvas(){
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { game, placeLocal, role, connection } = useGameStore() 

  // keep win overlay hidden until win
  const overlayRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const state = {
      hover: { x: -1, y: -1 },
      anims: [] as any[], lastTS: performance.now()
    }

    function geom(){
      const w = canvas.clientWidth, h = canvas.clientHeight
      const size = Math.min(w,h)
      const pad = Math.round(size * 0.06)
      const boardSize = size - pad*2
      const cell = boardSize / (game.size-1)
      return { w,h,pad,boardSize,cell }
    }

    function fit(){
      const cssW = canvas.clientWidth, cssH = canvas.clientHeight
      const DPR = dpr()
      canvas.width = Math.round(cssW*DPR)
      canvas.height = Math.round(cssH*DPR)
      ctx.setTransform(DPR,0,0,DPR,0,0)
      draw()
    }

    function toCell(e: MouseEvent){
      const r = canvas.getBoundingClientRect(); const {pad,cell} = geom()
      const x = (e.clientX - r.left - pad); const y = (e.clientY - r.top - pad)
      const ix = Math.round(x / cell); const iy = Math.round(y / cell)
      return { x: clamp(ix,0,game.size-1), y: clamp(iy,0,game.size-1) }
    }

    function draw(){
      const {w,h,pad,boardSize,cell} = geom()
      ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight)
      const grd = ctx.createLinearGradient(0,0,0,h); grd.addColorStop(0, CFG.bgTop); grd.addColorStop(1, CFG.bgBottom); ctx.fillStyle = grd; ctx.fillRect(0,0,w,h)
      // panel
      roundRect(ctx, pad-10, pad-10, boardSize+20, boardSize+20, 16)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke()
      // grid
      ctx.save(); ctx.translate(pad, pad)
      ctx.lineWidth = 1; ctx.strokeStyle = cssVar('--grid')
      for (let i=0;i<game.size;i++){ line(ctx, 0,i*cell,boardSize,i*cell); line(ctx, i*cell,0,i*cell,boardSize) }
      ctx.strokeStyle = cssVar('--grid-strong'); ctx.lineWidth = 1.5
      line(ctx, 0,0,boardSize,0); line(ctx, 0,boardSize,boardSize,boardSize); line(ctx, 0,0,0,boardSize); line(ctx, boardSize,0,boardSize,boardSize)
      // stars
      const stars = [3,7,11]; ctx.fillStyle = '#cfe6ff'
      for (const sy of stars) for (const sx of stars) filledCircle(ctx, sx*cell, sy*cell, CFG.starRadius)
      // hover (온라인: 내 턴 + 빈칸일 때만, 오프라인: 빈칸일 때만)
      const isOnline = connection === 'open' && !!role
      const cellEmpty =
        state.hover.y >= 0 && state.hover.y < game.size &&
        state.hover.x >= 0 && state.hover.x < game.size &&
        game.grid[state.hover.y]?.[state.hover.x] === 0
      const myTurn = !isOnline || (role === 'black' ? game.cur === 1 : game.cur === 2)
      if (state.hover.x>=0 && state.hover.y>=0 && !game.winning && cellEmpty && myTurn){
          const gx = state.hover.x * cell, gy = state.hover.y * cell
          ctx.save(); ctx.translate(gx,gy)
          ctx.fillStyle = CFG.hover.color; filledCircle(ctx, 0,0, cell*0.46)
          ctx.strokeStyle = CFG.hover.outline; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.arc(0,0,cell*0.46,0,Math.PI*2); ctx.stroke()
          drawStone(ctx, 0,0, game.cur as 1|2, cell, 0.66, true)
          ctx.restore()
      }
      // stones
      for (let y=0;y<game.size;y++){
        for (let x=0;x<game.size;x++){
          const c = game.grid[y][x]; if (!c) continue
          ctx.save(); ctx.translate(x*cell, y*cell); drawStone(ctx, 0,0,c as 1|2, cell, 1, false); ctx.restore()
        }
      }
      // winning line
      if (game.winning){
        const pulse = 0.7 + 0.3*Math.sin(performance.now()/300)
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 6
        ctx.strokeStyle = withAlpha(getComputedStyle(document.documentElement).getPropertyValue('--win').trim(), 0.65 * pulse)
        ctx.beginPath()
        for (let i=0;i<game.winning.line.length;i++){
          const p = game.winning.line[i]; const px = p.x*cell, py = p.y*cell
          if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py)
        }
        ctx.stroke(); ctx.restore()
      }
      ctx.restore()
    }

    function onMove(e: MouseEvent){ state.hover = toCell(e); draw() }
    function onLeave(){ state.hover = {x:-1,y:-1}; draw() }
    function onClick(e: MouseEvent){
            const p = toCell(e)
            const isOnline = connection === 'open' && !!role
            const cellEmpty = game.grid[p.y]?.[p.x] === 0
            const myTurn = !isOnline || (role === 'black' ? game.cur === 1 : game.cur === 2)
      
            if (game.winning) return
            if (!cellEmpty) return
      
            if (!isOnline) {
              // 싱글플레이: 기존 로컬 반영
              placeLocal(p.x, p.y)
              draw()
              return
            }
            if (!myTurn) return
      
            // 온라인: 낙관 반영 금지 → 전역 이벤트로 알림 (Controls에서 ws.move로 처리)
            window.dispatchEvent(new CustomEvent('omock:try-move', {
              detail: { row: p.y, col: p.x } // 서버 규격: row=y, col=x
            }))
    }

    function tick(ts: number){ state.lastTS = ts; requestAnimationFrame(tick) }
    requestAnimationFrame(tick)

    window.addEventListener('resize', fit, { passive: true })
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('click', onClick, { passive: true })
    fit()

    return () => {
      window.removeEventListener('resize', fit)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('click', onClick as any)
    }
  }, [placeLocal, role, connection, game.size, game.winning, game.cur, game.grid])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.hidden = !Boolean(game.winning)
  }, [game.winning])

  return (
    <div className="board-wrap">
      <div className="canvas-card">
        <canvas ref={canvasRef} aria-label="Gomoku board" role="img" />
        <div className="overlay" ref={overlayRef} hidden>
          <div className="banner">
            <h2>{game.winning ? `${game.winning.color === 1 ? 'Black' : 'White'} wins!` : ''}</h2>
            <p>Press <span className="kbd">N</span> for new game or keep exploring with <span className="kbd">Undo</span>/<span className="kbd">Redo</span>.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function withAlpha(hex: string, a: number){
  const c = hex.startsWith('#') ? hex.slice(1) : hex
  const r = parseInt(c.slice(0,2),16); const g = parseInt(c.slice(2,4),16); const b = parseInt(c.slice(4,6),16)
  return `rgba(${r},${g},${b},${a})`
}

function line(ctx: CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number){ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke() }
function filledCircle(ctx: CanvasRenderingContext2D,x:number,y:number,r:number){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill() }
function roundRect(ctx: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath() }
function drawStone(ctx: CanvasRenderingContext2D,cx:number,cy:number,color:1|2,cell:number,scale=1,ghost=false){
  const r = cell * 0.44 * scale
  if (!ghost){ ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.filter='blur(3px)'; filledCircle(ctx,cx+1.2,cy+1.6,r*0.9); ctx.filter='none' }
  const grd = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.2, cx, cy, r*1.1)
  if (color===1){ grd.addColorStop(0, '#3a3a3a'); grd.addColorStop(1, '#0a0a0a') }
  else { grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#cfd8ea') }
  if (ghost) ctx.fillStyle = color===1 ? 'rgba(20,25,40,0.35)' : 'rgba(255,255,255,0.35)'; else ctx.fillStyle = grd
  filledCircle(ctx,cx,cy,r)
  if (!ghost){ ctx.strokeStyle = color===1 ? 'rgba(255,255,255,0.10)' : 'rgba(10,20,30,0.18)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke() }
}
