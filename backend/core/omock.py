from typing import List, Literal, Tuple, Optional

Cell = Literal['black', 'white', None]
Player = Literal['black', 'white']
Reason = Literal['fiveInARow', 'overline', 'threeThree', 'fourFour']

class InvalidMove(Exception):
    def __init__(self, message: str, code: int = 4001):
        super().__init__(message)
        self.code = code

class GomokuGame:
    """
    Gomoku game logic with Renju rules for black (overline, 3-3, 4-4 forbidden).
    Maintains board state, current player, game over status, and winner.
    """
    def __init__(self, size: int = 15):
        self.size = size
        self.board: List[List[Cell]] = [[None] * size for _ in range(size)]
        self.current_player: Player = 'black'
        self.game_over: bool = False
        self.winner: Optional[Player] = None

    def count_direction(self, row: int, col: int, dr: int, dc: int, player: Player) -> int:
        count = 1
        for sign in (1, -1):
            r, c = row + dr * sign, col + dc * sign
            while 0 <= r < self.size and 0 <= c < self.size and self.board[r][c] == player:
                count += 1
                r += dr * sign
                c += dc * sign
        return count

    def is_overline(self, row: int, col: int) -> bool:
        # Overline = 6 or more in any direction for black only
        for dr, dc in ((0,1),(1,0),(1,1),(1,-1)):
            if self.count_direction(row, col, dr, dc, 'black') >= 6:
                return True
        return False

    def count_pattern(self, row: int, col: int, dr: int, dc: int,
                       player: Player, pattern: List[Optional[Cell]]) -> int:
        length = len(pattern)
        total = 0
        for offset in range(-length, 1):
            match = True
            for i, pat in enumerate(pattern):
                r = row + dr * (offset + i)
                c = col + dc * (offset + i)
                cell = self.board[r][c] if 0 <= r < self.size and 0 <= c < self.size else None
                if pat == 'empty':
                    if cell is not None:
                        match = False
                        break
                else:
                    if cell != player:
                        match = False
                        break
            if match and any(
                (row == row + dr * (offset + i) and col == col + dc * (offset + i))
                for i in range(length)
            ):
                total += 1
        return total

    def count_open_three(self, row: int, col: int) -> int:
        open3 = [None, 'black', 'black', 'black', None]
        total = 0
        for dr, dc in ((0,1),(1,0),(1,1),(1,-1)):
            total += self.count_pattern(row, col, dr, dc, 'black', open3)
        return total

    def count_open_four(self, row: int, col: int) -> int:
        open4 = [None, 'black', 'black', 'black', 'black', None]
        total = 0
        for dr, dc in ((0,1),(1,0),(1,1),(1,-1)):
            total += self.count_pattern(row, col, dr, dc, 'black', open4)
        return total

    def check_win(self, row: int, col: int) -> bool:
        # 5 or more in any direction for both players
        for dr, dc in ((0,1),(1,0),(1,1),(1,-1)):
            if self.count_direction(row, col, dr, dc, self.current_player) >= 5:
                return True
        return False

    def place_stone(self, row: int, col: int) -> Tuple[Player, Optional[Reason]]:
        """
        Attempt to place a stone for current_player at (row, col).
        Returns (next_player, reason_for_game_over).
        Raises InvalidMove for illegal moves or forbidden Renju rules.
        """
        if self.game_over:
            raise InvalidMove("Game is already over", code=4004)
        if not (0 <= row < self.size and 0 <= col < self.size):
            raise InvalidMove("Out of bounds", code=4002)
        if self.board[row][col] is not None:
            raise InvalidMove("Cell occupied", code=4001)

        # Renju rules for black
        if self.current_player == 'black':
            # simulate
            self.board[row][col] = 'black'
            if self.is_overline(row, col):
                self.board[row][col] = None
                raise InvalidMove("Forbidden: overline", code=4003)
            if self.count_open_three(row, col) > 1:
                self.board[row][col] = None
                raise InvalidMove("Forbidden: double three", code=4005)
            if self.count_open_four(row, col) > 1:
                self.board[row][col] = None
                raise InvalidMove("Forbidden: double four", code=4006)
        else:
            # place for white
            self.board[row][col] = 'white'

        # normal victory
        if self.check_win(row, col):
            self.game_over = True
            self.winner = self.current_player
            return (self.current_player, 'fiveInARow')

        # switch turn
        next_player = 'white' if self.current_player == 'black' else 'black'
        self.current_player = next_player
        return (next_player, None)

    def reset(self):
        self.board = [[None] * self.size for _ in range(self.size)]
        self.current_player = 'black'
        self.game_over = False
        self.winner = None
