// src/lib/ws.ts
import type { ClientMsg, ServerMsg } from '@/types'

type JoinPayload = { gameId?: string; playerId: string }

type Options = {
  /** 연결 직후 자동으로 joinGame을 보낼 정보 (권장) */
  joinOnOpen?: JoinPayload
  /** 자동 재연결 여부 (기본 true) */
  autoReconnect?: boolean
  /** 최대 재시도 횟수 (기본 무제한) */
  maxRetries?: number
  /** 백오프 기본(ms). 지수백오프 적용, 상한 8000ms (기본 800) */
  backoffMs?: number
  onOpen?: () => void
  onClose?: (ev: CloseEvent) => void
}

type WSHandle = {
  /** 원시 메시지 전송(권장 X, join 전송 규칙 우회 가능) */
  send: (m: ClientMsg) => void
  /** 명세 전용 헬퍼들 */
  joinGame: (p: JoinPayload) => void
  move: (row: number, col: number) => void
  resign: (player: 'black' | 'white') => void
  ping: () => void
  sync: () => void
  /** 연결 닫기(자동 재연결 중단) */
  close: () => void
  /** 현재 연결 열림 여부 */
  isOpen: () => boolean
}

export function connectWS(
  url: string,
  onMsg: (m: ServerMsg) => void,
  opts: Options = {}
): WSHandle {
  let ws: WebSocket | null = null
  let userClosed = false
  let retries = 0
  const autoReconnect = opts.autoReconnect ?? true
  const maxRetries = opts.maxRetries ?? Number.POSITIVE_INFINITY
  const baseBackoff = Math.max(0, opts.backoffMs ?? 800)

  // --- join & 큐 제어 ---
  let lastJoin: JoinPayload | undefined = opts.joinOnOpen
  let joinSent = false
  const pending: ClientMsg[] = []

  let pingTimer: number | undefined

  function scheduleReconnect() {
    if (!autoReconnect || userClosed || retries >= maxRetries) return
    const delay = Math.min(baseBackoff * Math.pow(2, retries++), 8000)
    setTimeout(open, delay)
  }

  function startPing() {
    stopPing()
    // 가벼운 keep-alive (서버가 pong 회신)
    pingTimer = window.setInterval(() => {
      trySend({ type: 'ping', payload: {} } as ClientMsg)
    }, 30000)
  }

  function stopPing() {
    if (pingTimer !== undefined) {
      clearInterval(pingTimer)
      pingTimer = undefined
    }
  }

  function open() {
    ws = new WebSocket(url)

    ws.onopen = () => {
      retries = 0
      joinSent = false
      startPing()
      // 연결 직후 joinGame이 **첫 메시지**가 되도록 강제
      if (lastJoin) {
        rawSend({ type: 'joinGame', payload: lastJoin } as ClientMsg)
        joinSent = true
        flushPending()
      }
      opts.onOpen?.()
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as ServerMsg
        onMsg(msg)
      } catch {
        // JSON 파싱 실패는 무시
      }
    }

    ws.onclose = (ev) => {
      stopPing()
      if (!userClosed) scheduleReconnect()
      opts.onClose?.(ev)
    }

    ws.onerror = () => {
      // 오류는 onclose로 이어질 수 있음. 별도 처리 없음.
    }
  }

  function isOpen(): boolean {
    return !!ws && ws.readyState === WebSocket.OPEN
  }

  function rawSend(m: ClientMsg) {
    try {
      ws?.send(JSON.stringify(m))
    } catch {
      // 전송 실패는 큐로 맡기지 않음(소켓 상태 이슈)
    }
  }

  function flushPending() {
    if (!isOpen() || !joinSent) return
    while (pending.length) {
      const m = pending.shift()!
      // join 이후에만 보낼 수 있게 보장됨
      rawSend(m)
    }
  }

  function trySend(m: ClientMsg) {
    // 규칙: 첫 메시지는 반드시 joinGame
    if (!joinSent) {
      if ((m as any).type !== 'joinGame') {
        pending.push(m)
        return
      }
      // joinGame이면 바로 기록하고 전송
      lastJoin = (m as any).payload as JoinPayload
      if (isOpen()) {
        rawSend(m)
        joinSent = true
        flushPending()
      } else {
        pending.unshift(m) // open 직후 가장 먼저 나가도록
      }
      return
    }

    // 이미 join이 끝났으면 평소대로
    if (!isOpen()) {
      pending.push(m)
      return
    }
    rawSend(m)
  }

  // --- 공개 API ---
  function send(m: ClientMsg) {
    trySend(m)
  }

  function joinGame(p: JoinPayload) {
    // 연결 후 첫 메시지로 나가게끔 보장
    trySend({ type: 'joinGame', payload: p } as ClientMsg)
  }

  function move(row: number, col: number) {
    trySend({ type: 'move', payload: { row, col } } as ClientMsg)
  }

  function resign(player: 'black' | 'white') {
    trySend({ type: 'resign', payload: { player } } as ClientMsg)
  }

  function ping() {
    trySend({ type: 'ping', payload: {} } as ClientMsg)
  }

  function sync() {
    trySend({ type: 'sync', payload: {} } as ClientMsg)
  }

  function close() {
    userClosed = true
    stopPing()
    ws?.close()
  }

  // 즉시 연결 시도
  open()

  return { send, joinGame, move, resign, ping, sync, close, isOpen }
}
