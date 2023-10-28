const fruitCodes = {
  watermelon: 0x1f349,
  grapes: 0x1f347,
  orange: 0x1f34a,
  redApple: 0x1f34e,
  greenApple: 0x1f34f,
};
const fruitCodeValues = Object.values(fruitCodes);

function awaitTransition(element, action) {
  return new Promise((resolve) => {
    element.addEventListener("transitionend", () => resolve(), { once: true });
    action();
  });
}

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

function getCoordinates(index, board) {
  const row = Math.floor(index / board.width);
  const column = index % board.width;
  return [row, column];
}

function getIndex(row, column, board) {
  return row * board.width + column;
}

function getMatches(board, index) {
  const [row, column] = getCoordinates(index, board);
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

async function crushMatches(board, matchIndexes) {
  if (!matchIndexes.size) return;
  const matchEmojis = Array.from(matchIndexes, (i) => board.emojis[i]);
  await awaitTransition(matchEmojis[0], () => {
    matchEmojis.forEach((e) => {
      e.style.opacity = 0;
    });
  });
  matchIndexes.forEach((i) => {
    board.emojis[i].remove();
    board.emojis[i] = null;
  });
}

async function performGravity(board) {
  const promises = [];
  const newEmojiIndexes = [];
  for (let c = 0; c < board.width; c++) {
    const queue = [];
    for (let r = board.height - 1; r >= 0; r--) {
      const index = getIndex(r, c, board);
      if (board.emojis[index] !== null) {
        queue.push(index);
      }
    }
    const delta = board.height - queue.length;
    for (let r = board.height - 1; r >= 0; r--) {
      const toIndex = getIndex(r, c, board);
      if (queue.length) {
        const fromIndex = queue.shift();
        if (fromIndex !== toIndex) {
          promises.push(moveEmoji(board, fromIndex, toIndex));
          newEmojiIndexes.push(toIndex);
        }
      } else {
        promises.push(addEmoji(board, toIndex, delta));
        newEmojiIndexes.push(toIndex);
      }
    }
  }
  await Promise.all(promises);
  return newEmojiIndexes;
}

async function moveEmoji(board, fromIndex, toIndex) {
  if (!board.emojis[fromIndex]) return;
  [board.emojis[toIndex], board.emojis[fromIndex]] = [
    board.emojis[fromIndex],
    board.emojis[toIndex],
  ];
  if (board.emojis[fromIndex]) {
    moveEmojiPosition(board, fromIndex);
  }
  await moveEmojiPosition(board, toIndex);
}

async function moveEmojiPosition(board, index) {
  await awaitTransition(board.emojis[index], () => {
    Object.assign(
      board.emojis[index].style,
      calculateEmojiPosition(board, index)
    );
  });
}

function onPointerDown(board) {
  return function (e) {
    const overElement = document.elementFromPoint(e.clientX, e.clientY);
    if (!overElement.classList.contains("square")) return;
    board.selectedSquare = board.squares.indexOf(overElement);
    overElement.classList.add("selected");
  };
}

function onPointerUp(board) {
  return async function () {
    if (board.selectedSquare === -1) return;
    const selectedSquareIndex = board.selectedSquare;
    board.squares[selectedSquareIndex].classList.remove("selected");
    board.selectedSquare = -1;
    if (board.hoveredSquare === -1) return;
    const hoveredSquareIndex = board.squares.indexOf(board.hoveredSquare);
    board.hoveredSquare.classList.remove("hovered");
    board.hoveredSquare = -1;
    await moveEmoji(board, selectedSquareIndex, hoveredSquareIndex);
    const foundMatches = await performMatchCycle(board, [
      selectedSquareIndex,
      hoveredSquareIndex,
    ]);
    if (!foundMatches) {
      await moveEmoji(board, selectedSquareIndex, hoveredSquareIndex);
    }
  };
}

function calculateHoveredSquareIndex(overElement, board) {
  if (!overElement.classList.contains("square")) return -1;
  const index = board.squares.indexOf(overElement);
  const [i, j] = getCoordinates(index, board);
  const selectedIndex = board.selectedSquare;
  const [si, sj] = getCoordinates(selectedIndex, board);
  if (si === i) {
    const delta = Math.abs(sj - j);
    if (delta === 1) return getIndex(i, j, board);
    if (delta === 2 || delta === 3)
      return getIndex(i, sj + Math.sign(j - sj), board);
  }
  if (sj === j) {
    const delta = Math.abs(si - i);
    if (delta === 1) return getIndex(i, j, board);
    if (delta === 2 || delta === 3)
      return getIndex(si + Math.sign(i - si), j, board);
  }
  return -1;
}

function onPointerMove(board) {
  return function (e) {
    if (board.selectedSquare === -1) return;
    const overElement = document.elementFromPoint(e.clientX, e.clientY);
    const calculatedIndex = calculateHoveredSquareIndex(overElement, board);
    if (
      calculatedIndex === board.selectedSquare ||
      calculatedIndex === board.hoveredSquare
    )
      return;
    if (calculatedIndex === -1) {
      if (board.hoveredSquare !== -1) {
        board.hoveredSquare.classList.remove("hovered");
        board.hoveredSquare = -1;
      }
      return;
    }
    board.hoveredSquare = board.squares[calculatedIndex];
    board.hoveredSquare.classList.add("hovered");
  };
}

async function performMatchCycle(board, coordinates) {
  const allMatches = new Set();
  for (const index of coordinates) {
    const matches = getMatches(board, index);
    for (const match of matches) {
      allMatches.add(match);
    }
  }
  if (!allMatches.size) return false;
  while (allMatches.size) {
    await crushMatches(board, allMatches);
    allMatches.clear();
    const newEmojiIndexes = await performGravity(board);
    for (const index of newEmojiIndexes) {
      const matches = getMatches(board, index);
      for (const match of matches) {
        allMatches.add(match);
      }
    }
  }
  return true;
}

function createBoard(width, height) {
  const element = document.createElement("div");
  element.classList.add("board");
  element.style.gridTemplateColumns = `repeat(${width}, auto)`;
  element.style.gridTemplateRows = `repeat(${height}, auto)`;
  const board = {
    element,
    width,
    height,
    selectedSquare: -1,
    hoveredSquare: -1,
    squares: [],
    emojis: [],
  };
  for (let i = 0; i < width * height; i++) {
    const square = createSquare();
    element.appendChild(square);
    board.squares.push(square);
  }
  board.squares[0].classList.add("top-left");
  board.squares[width - 1].classList.add("top-right");
  board.squares[(height - 1) * width].classList.add("bottom-left");
  board.squares[board.squares.length - 1].classList.add("bottom-right");
  document.addEventListener("pointerdown", onPointerDown(board));
  document.addEventListener("pointerup", onPointerUp(board));
  document.addEventListener("pointermove", onPointerMove(board));
  return board;
}

function calculateEmojiPosition(board, emojiIndex, rowDelta = 0) {
  const row = Math.floor(emojiIndex / board.width) - rowDelta;
  const column = emojiIndex % board.width;
  return {
    top: `${(row + 0.5) * (100 / board.height)}%`,
    left: `${(column + 0.5) * (100 / board.width)}%`,
  };
}

async function addEmoji(board, index, initialRowDelta = 0) {
  const element = document.createElement("div");
  element.classList.add("emoji");
  const { top, left } = calculateEmojiPosition(board, index, initialRowDelta);
  element.style.top = top;
  element.style.left = left;
  const fruitCodeValue =
    fruitCodeValues[Math.floor(Math.random() * fruitCodeValues.length)];
  element.innerText = String.fromCodePoint(fruitCodeValue);
  board.emojis[index] = element;
  board.emojisElement.appendChild(element);
  if (initialRowDelta !== 0) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    await moveEmojiPosition(board, index);
  }
}

async function startGame() {
  const board = createBoard(6, 8);
  board.emojisElement = document.createElement("div");
  for (let i = 0; i < board.width * board.height; i++) {
    addEmoji(board, i);
  }

  const boardAreaElement = document.getElementById("boardArea");
  boardAreaElement.appendChild(board.element);
  boardAreaElement.appendChild(board.emojisElement);
  window.board = board;

  const coordinates = Array.from(
    { length: board.width * board.height },
    (_, i) => i
  );
  await new Promise((resolve) => setTimeout(resolve, 1));
  await performMatchCycle(board, coordinates);
}

startGame();
