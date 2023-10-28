let hoveredSquare = null;

function createSquare() {
  const square = document.createElement("div");
  square.classList.add("square");
  return square;
}

function testMatch(potentialSet, board) {
  const matchSet = [potentialSet.pop()];
  while (potentialSet.length) {
    const currentElement = potentialSet.pop();
    if (
      board.emojis[currentElement].textContent ===
      board.emojis[matchSet[matchSet.length - 1]].textContent
    ) {
      matchSet.push(currentElement);
    } else {
      if (matchSet.length >= 3) {
        break;
      } else {
        matchSet.splice(0, matchSet.length);
        matchSet.push(currentElement);
      }
    }
  }
  if (matchSet.length >= 3) {
    return matchSet;
  }
  return [];
}

function buildSet(
  board,
  [startRow, startColumn],
  [endRow, endColumn],
  [rowStep, columnStep]
) {
  const set = [];
  const start = startRow * board.width + startColumn;
  const end = endRow * board.width + endColumn;
  const step = rowStep * board.width + columnStep;
  for (let i = start; i <= end; i += step) {
    set.push(i);
  }
  return set;
}

function getMatches(board, row, column) {
  const columnMatch = testMatch(
    buildSet(
      board,
      [Math.max(row - 2, 0), column],
      [Math.min(row + 2, board.height - 1), column],
      [1, 0]
    ),
    board
  );
  const rowMatch = testMatch(
    buildSet(
      board,
      [row, Math.max(column - 2, 0)],
      [row, Math.min(column + 2, board.width - 1)],
      [0, 1]
    ),
    board
  );
  return new Set([...columnMatch, ...rowMatch]);
}

function crushMatches(board, matchIndexes) {
  return new Promise((resolve) => {
    if (!matchIndexes.size) return resolve();
    const matchEmojis = Array.from(matchIndexes, (i) => board.emojis[i]);
    matchEmojis[0].addEventListener(
      "transitionend",
      () => {
        matchIndexes.forEach((i) => {
          board.emojis[i].remove();
          board.emojis[i] = null;
        });
        resolve();
      },
      { once: true }
    );
    matchEmojis.forEach((e) => {
      e.style.opacity = 0;
    });
  });
}

function startGravity(board) {
  for (let c = 0; c < board.width; c++) {
    const queue = [];
    for (let r = board.height - 1; r >= 0; r--) {
      const index = r * board.width + c;
      if (board.emojis[index] !== null) {
        queue.push(index);
      }
    }
    const delta = board.height - queue.length;
    for (let r = board.height - 1; r >= 0; r--) {
      const toIndex = r * board.width + c;
      if (queue.length) {
        const fromIndex = queue.shift();
        if (fromIndex !== toIndex) {
          moveEmoji(board, fromIndex, toIndex);
        }
      } else {
        addEmoji(board, toIndex, delta);
      }
    }
  }
}

function moveEmoji(board, fromIndex, toIndex) {
  if (!board.emojis[fromIndex]) return;
  [board.emojis[toIndex], board.emojis[fromIndex]] = [
    board.emojis[fromIndex],
    board.emojis[toIndex],
  ];
  Object.assign(
    board.emojis[toIndex].style,
    calculateEmojiPosition(board, toIndex)
  );
  if (!board.emojis[fromIndex]) return;
  Object.assign(
    board.emojis[fromIndex].style,
    calculateEmojiPosition(board, fromIndex)
  );
}

function onPointerDown(i, j, board) {
  return function () {
    if (board.selectedSquare) {
      const { i: si, j: sj } = board.selectedSquare;
      board.squareRows[si][sj].classList.remove("selected");
      board.selectedSquare = null;
    } else {
      board.selectedSquare = { i, j };
      board.squareRows[i][j].classList.add("selected");
    }
  };
}

function onPointerUp(board) {
  return function () {
    if (!board.selectedSquare) return;
    const { i: si, j: sj } = board.selectedSquare;
    board.squareRows[si][sj].classList.remove("selected");
    board.selectedSquare = null;
    if (!hoveredSquare) return;
    const squareRow = hoveredSquare.parentElement;
    const j = Array.prototype.indexOf.call(squareRow.children, hoveredSquare);
    const i = Array.prototype.indexOf.call(
      squareRow.parentElement.children,
      squareRow
    );
    hoveredSquare.classList.remove("hovered");
    hoveredSquare = null;
    if (
      (i === si && Math.abs(j - sj) === 1) ||
      (j === sj && Math.abs(i - si) === 1)
    ) {
      const aIndex = si * board.width + sj;
      const bIndex = i * board.width + j;

      board.emojis[aIndex].addEventListener(
        "transitionend",
        async () => {
          const aMatch = getMatches(board, i, j);
          const bMatch = getMatches(board, si, sj);
          const allMatches = new Set([...aMatch, ...bMatch]);
          if (!allMatches.size) {
            moveEmoji(board, aIndex, bIndex);
            return;
          }
          await crushMatches(board, allMatches);
          startGravity(board);
        },
        { once: true }
      );
      moveEmoji(board, aIndex, bIndex);
    }
  };
}

function createBoard(width, height) {
  const element = document.createElement("div");
  element.classList.add("board");
  const squareRows = [];
  const board = { element, width, height, squareRows, selectedSquare: null };
  for (let i = 0; i < height; i++) {
    const row = document.createElement("div");
    row.classList.add("row");
    const squareRow = [];
    squareRows.push(squareRow);
    for (let j = 0; j < width; j++) {
      const square = createSquare();
      square.addEventListener("pointerdown", onPointerDown(i, j, board));
      square.addEventListener("pointerup", onPointerUp(board));
      row.appendChild(square);
      squareRow.push(square);
    }
    element.appendChild(row);
  }
  board.element.addEventListener("pointermove", (e) => {
    if (!board.selectedSquare) return;
    const overElement = document.elementFromPoint(e.clientX, e.clientY);
    if (hoveredSquare && overElement !== hoveredSquare) {
      hoveredSquare.classList.remove("hovered");
      hoveredSquare = null;
    }
    if (!overElement.classList.contains("square")) return;
    const squareRow = overElement.parentElement;
    const j = Array.prototype.indexOf.call(squareRow.children, overElement);
    const i = Array.prototype.indexOf.call(
      squareRow.parentElement.children,
      squareRow
    );
    const { i: si, j: sj } = board.selectedSquare;
    if (
      (i === si && j === sj) ||
      (i === si && Math.abs(j - sj) === 1) ||
      (j === sj && Math.abs(i - si) === 1)
    ) {
      hoveredSquare = board.squareRows[i][j];
      hoveredSquare.classList.add("hovered");
    }
  });
  return board;
}

const fruitCodes = {
  watermelon: 0x1f349,
  grapes: 0x1f347,
  orange: 0x1f34a,
  redApple: 0x1f34e,
  greenApple: 0x1f34f,
  cherry: 0x1f352,
  strawberry: 0x1f353,
  kiwi: 0x1f95d,
};

function calculateEmojiPosition(board, emojiIndex, rowDelta = 0) {
  const row = Math.floor(emojiIndex / board.width) - rowDelta;
  const column = emojiIndex % board.width;
  return {
    top: `${(row + 0.5) * (100 / board.height)}%`,
    left: `${(column + 0.5) * (100 / board.width)}%`,
  };
}
const fruitCodeValues = Object.values(fruitCodes);

function addEmoji(board, index, initialRowDelta = 0) {
  const element = document.createElement("div");
  element.classList.add("emoji");
  const { top, left } = calculateEmojiPosition(board, index, initialRowDelta);
  element.style.top = top;
  element.style.left = left;
  if (initialRowDelta !== 0) {
    setTimeout(() => {
      const { top, left } = calculateEmojiPosition(board, index);
      element.style.top = top;
      element.style.left = left;
    }, 1);
  }
  const fruitCodeValue =
    fruitCodeValues[Math.floor(Math.random() * fruitCodeValues.length)];
  element.innerText = String.fromCodePoint(fruitCodeValue);
  board.emojis[index] = element;
  board.emojisElement.appendChild(element);
}

function addEmojis(board) {
  board.emojis = [];
  for (let i = 0; i < board.height; i++) {
    for (let j = 0; j < board.width; j++) {
      addEmoji(board, i * board.width + j);
    }
  }
}

function startGame() {
  const board = createBoard(6, 8);
  board.emojisElement = document.createElement("div");
  addEmojis(board);
  const boardAreaElement = document.getElementById("boardArea");
  boardAreaElement.appendChild(board.element);
  boardAreaElement.appendChild(board.emojisElement);
  window.board = board;
}

startGame();
