import React, { useState } from 'react';

const BOARD_SIZE = 15;
const CELL_GAP = 40;
const STONE_SCALE = 1.5;
const STONE_SIZE = 20 * STONE_SCALE;

type Cell = 'black' | 'white' | null;
type Winner = 'black' | 'white' | null;

export default function GomokuBoard() {
  const [board, setBoard] = useState<Cell[][]>(
    Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(null))
  );
  const [currentPlayer, setCurrentPlayer] = useState<Cell>('black');
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [winner, setWinner] = useState<Winner>(null);

  // 특정 방향으로 연속된 돌 개수
  const countDirection = (
    b: Cell[][],
    row: number,
    col: number,
    dr: number,
    dc: number,
    player: Cell
  ): number => {
    let count = 1;
    for (let sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (
        r >= 0 && r < BOARD_SIZE &&
        c >= 0 && c < BOARD_SIZE &&
        b[r][c] === player
      ) {
        count++;
        r += dr * sign;
        c += dc * sign;
      }
    }
    return count;
  };

  // 오버라인(6목 이상) 검사
  const isOverline = (b: Cell[][], row: number, col: number): boolean => {
    for (let [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      if (countDirection(b, row, col, dr, dc, 'black') >= 6) return true;
    }
    return false;
  };

  // 특정 패턴 개수 세기 (슬라이딩 윈도우)
  const countPattern = (
    b: Cell[][],
    row: number,
    col: number,
    dr: number,
    dc: number,
    player: Cell,
    pattern: (Cell | 'empty')[],
    length: number
  ): number => {
    let count = 0;
    for (let offset = -length; offset <= 0; offset++) {
      let match = true;
      for (let i = 0; i < pattern.length; i++) {
        const r = row + dr * (offset + i);
        const c = col + dc * (offset + i);
        const cell = (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE)
          ? b[r][c]
          : null;
        if (pattern[i] === 'empty') {
          if (cell !== null) { match = false; break; }
        } else {
          if (cell !== player) { match = false; break; }
        }
      }
      if (match) {
        const indices = pattern.map((_, i) => [row + dr * (offset + i), col + dc * (offset + i)]);
        if (indices.some(([r, c]) => r === row && c === col)) count++;
      }
    }
    return count;
  };

  // 열린 삼(3목) 패턴 개수
  const countOpenThree = (b: Cell[][], row: number, col: number): number => {
    let total = 0;
    const open3: (Cell | 'empty')[] = ['empty', 'black', 'black', 'black', 'empty'];
    for (let [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      total += countPattern(b, row, col, dr, dc, 'black', open3, 4);
    }
    return total;
  };

  // 열린 사(4목) 패턴 개수
  const countOpenFour = (b: Cell[][], row: number, col: number): number => {
    let total = 0;
    const open4: (Cell | 'empty')[] = ['empty', 'black', 'black', 'black', 'black', 'empty'];
    for (let [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      total += countPattern(b, row, col, dr, dc, 'black', open4, 5);
    }
    return total;
  };

  // 클릭 처리
  const handleClick = (row: number, col: number): void => {
    if (gameOver || board[row][col] !== null) return;
    // 금수 검사용 보드 복사
    const testBoard = board.map(r => [...r]);
    if (currentPlayer === 'black') {
      testBoard[row][col] = 'black';
      if (isOverline(testBoard, row, col)) {
        alert('금수: 장목(6목 이상)');
        return;
      }
      if (countOpenThree(testBoard, row, col) > 1) {
        alert('금수: 삼삼(열삼)');
        return;
      }
      if (countOpenFour(testBoard, row, col) > 1) {
        alert('금수: 사사(양사)');
        return;
      }
    }
    // 정상 착수
    const newBoard = testBoard;
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    // 정상 승리(5목) 체크
    for (let [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      if (countDirection(newBoard, row, col, dr, dc, currentPlayer) >= 5) {
        setGameOver(true);
        setWinner(currentPlayer);
        return;
      }
    }
    setCurrentPlayer(prev => (prev === 'black' ? 'white' : 'black'));
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <style>{`
        @keyframes drop {
          0% { transform: translateY(-20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .stone {
          animation: drop 0.3s ease-out;
        }
      `}</style>

      {gameOver && winner && <h2>{winner === 'black' ? '흑돌' : '백돌'} 승리!</h2>}
      {!gameOver && <h3>현재 차례: {currentPlayer === 'black' ? '흑돌' : '백돌'}</h3>}

      <div
        style={{
          position: 'relative',
          width: BOARD_SIZE * CELL_GAP,
          height: BOARD_SIZE * CELL_GAP,
          margin: '20px auto',
          backgroundColor: '#DEB887',
        }}
      >
        {[...Array(BOARD_SIZE)].map((_, idx) => (
          <React.Fragment key={idx}>
            <div
              style={{
                position: 'absolute',
                top: idx * CELL_GAP,
                left: 0,
                width: BOARD_SIZE * CELL_GAP,
                height: 1,
                backgroundColor: '#333'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: idx * CELL_GAP,
                width: 1,
                height: BOARD_SIZE * CELL_GAP,
                backgroundColor: '#333'
              }}
            />
          </React.Fragment>
        ))}

        {board.map((rowArr, row) =>
          rowArr.map((cell, col) => (
            <div
              key={`${row}-${col}`}
              onClick={() => handleClick(row, col)}
              style={{
                position: 'absolute',
                top: row * CELL_GAP - STONE_SIZE / 2,
                left: col * CELL_GAP - STONE_SIZE / 2,
                width: STONE_SIZE,
                height: STONE_SIZE,
                cursor: !gameOver && !board[row][col] ? 'pointer' : 'default'
              }}
            >
              {cell && (
                <div
                  className="stone"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: cell === 'black'
                      ? 'radial-gradient(circle at 30% 30%, #444, #000)'
                      : 'radial-gradient(circle at 30% 30%, #fff, #ccc)',
                    boxShadow: cell === 'black'
                      ? 'inset 0 0 5px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.6)'
                      : 'inset 0 0 5px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.3)',
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>

      {gameOver && <button onClick={() => window.location.reload()}>다시 시작</button>}
    </div>
  );
}
