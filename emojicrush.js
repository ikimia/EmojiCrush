const numEmojis = 5;

function awaitTransition(element, action) {
  return new Promise((resolve) => {
    element.addEventListener("transitionend", resolve, { once: true });
    action();
  });
}

function createSquare() {
  const square = document.createElement("div");
  square.classList.add("square");
  return square;
}

function testMatch(potentialSet, board) {
  let matchSet = [potentialSet.pop()];
  while (potentialSet.length) {
    const currentElement = potentialSet.pop();
    if (
      board.emojis[currentElement].element.dataset.emoji ===
      board.emojis[matchSet[0]].element.dataset.emoji
    ) {
      matchSet.push(currentElement);
    } else {
      if (matchSet.length >= 3) {
        break;
      } else {
        matchSet = [currentElement];
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

function isBomb(board, index) {
  return board.emojis[index].element.dataset.emoji === "bomb";
}

function getBombMatches(board, firstBombIndex) {
  const matches = new Set();
  const accountedBombs = new Set();
  const bombStack = [firstBombIndex];
  while (bombStack.length) {
    const bombIndex = bombStack.pop();
    accountedBombs.add(bombIndex);
    const [row, column] = getCoordinates(bombIndex, board);
    for (let i = row - 1; i <= row + 1; i++) {
      for (let j = column - 1; j <= column + 1; j++) {
        if (i < 0 || i > board.height - 1) continue;
        if (j < 0 || j > board.width - 1) continue;
        const index = getIndex(i, j, board);
        matches.add(index);
        if (isBomb(board, index) && !accountedBombs.has(index)) {
          bombStack.push(index);
        }
      }
    }
  }
  return matches;
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
  const bombIndexes = Array.from(matchIndexes).filter((i) => isBomb(board, i));
  if (bombIndexes.length) {
    for (let i = 0; i < 2; i++) {
      await Promise.all(bombIndexes.map((i) => setEmojiOpacity(board, i, 0)));
      await Promise.all(bombIndexes.map((i) => setEmojiOpacity(board, i, 1)));
    }
  }
  await Promise.all(
    Array.from(matchIndexes, (i) => setEmojiOpacity(board, i, 0))
  );
  matchIndexes.forEach((i) => {
    board.emojis[i].element.remove();
    board.emojis[i] = null;
  });
  matchIndexes.clear();
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
        addEmoji(board, toIndex, delta);
        promises.push(setEmojiIndex(board, toIndex));
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
  const promises = [setEmojiIndex(board, toIndex)];
  if (board.emojis[fromIndex]) {
    promises.push(setEmojiIndex(board, fromIndex));
  }
  await Promise.all(promises);
}

async function setEmojiIndex(board, index) {
  const { element, position: fromPosition } = board.emojis[index];
  const toPosition = calculateEmojiPosition(board, index);
  board.emojis[index].position = toPosition;
  const properties = { transform: [fromPosition, toPosition] };
  const options = { duration: 250, fill: "forwards", easing: "ease-in-out" };
  const animation = element.animate(properties, options);
  await animation.finished;
  element.style.transform = toPosition;
  animation.cancel();
}

async function setEmojiOpacity(board, index, value) {
  const element = board.emojis[index].element;
  const properties = { opacity: value };
  const options = { duration: 250, fill: "forwards" };
  await element.animate(properties, options).finished;
}

let p1 = null;
function onPointerDown(board) {
  return function (e) {
    p1 = { x: e.clientX, y: e.clientY };
    const overElement = document.elementFromPoint(e.clientX, e.clientY);
    if (!overElement.classList.contains("square")) return;
    board.selectedSquare = board.squares.indexOf(overElement);
    overElement.classList.add("selected");
  };
}

function onPointerUp(board) {
  return async function () {
    const { selectedSquare, hoveredSquare } = board;
    board.selectedSquare = -1;
    board.hoveredSquare = -1;
    if (selectedSquare === -1) return;
    board.squares[selectedSquare].classList.remove("selected");
    if (hoveredSquare === -1) return;
    board.squares[hoveredSquare].classList.remove("hovered");
    await moveEmoji(board, selectedSquare, hoveredSquare);
    const foundMatches = await performMatchCycle(board, [
      selectedSquare,
      hoveredSquare,
    ]);
    if (!foundMatches) {
      await moveEmoji(board, selectedSquare, hoveredSquare);
    }
  };
}

function calculateHoveredSquareIndex(board, p2) {
  const squareSize = board.squares[0].getBoundingClientRect().width;
  const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  if (distance < squareSize / 2 || distance > 2.75 * squareSize) return -1;

  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
  if (Math.abs(angle) < 45) {
    if (board.selectedSquare % board.width === board.width - 1) return -1;
    return board.selectedSquare + 1;
  }
  if (Math.abs(angle) > 135) {
    if (board.selectedSquare % board.width === 0) return -1;
    return board.selectedSquare - 1;
  }
  if (angle > 0) {
    if (board.selectedSquare >= board.width * (board.height - 1)) return -1;
    return board.selectedSquare + board.width;
  }
  if (board.selectedSquare < board.width) return -1;
  return board.selectedSquare - board.width;
}

function onPointerMove(board) {
  return function (e) {
    if (board.selectedSquare === -1) return;
    const p2 = { x: e.clientX, y: e.clientY };
    const calculatedIndex = calculateHoveredSquareIndex(board, p2);
    if (
      calculatedIndex === board.selectedSquare ||
      calculatedIndex === board.hoveredSquare
    )
      return;
    if (board.hoveredSquare !== -1) {
      board.squares[board.hoveredSquare].classList.remove("hovered");
    }
    board.hoveredSquare = calculatedIndex;
    if (board.hoveredSquare !== -1) {
      board.squares[board.hoveredSquare].classList.add("hovered");
    }
  };
}

async function matchNonBombIndexesAndConvertBombs(
  board,
  indexes,
  matchIndexes
) {
  const newBombIndexes = new Set();
  for (const index of indexes) {
    if (isBomb(board, index)) continue;
    const matches = getMatches(board, index);
    matches.forEach((match) => matchIndexes.add(match));
    if (matches.size <= 3) continue;
    if (Array.from(matches).some((m) => newBombIndexes.has(m))) continue;
    newBombIndexes.add(index);
  }
  const promises = Array.from(newBombIndexes, async (index) => {
    matchIndexes.delete(index);
    await setEmojiOpacity(board, index, 0);
    board.emojis[index].element.dataset.emoji = "bomb";
    await setEmojiOpacity(board, index, 1);
  });
  await Promise.all(promises);
  newBombIndexes.clear();
}

async function performMatchCycle(board, indexes) {
  document.documentElement.style.pointerEvents = "none";
  const preMatchBombIndexes = indexes.filter((i) => isBomb(board, i));
  const matchIndexes = new Set();
  await matchNonBombIndexesAndConvertBombs(board, indexes, matchIndexes);
  for (const index of preMatchBombIndexes) {
    for (const match of getBombMatches(board, index)) {
      matchIndexes.add(match);
    }
  }
  const crushedDuringFirstCycle = matchIndexes.size > 0;
  while (matchIndexes.size) {
    await crushMatches(board, matchIndexes);
    const newIndexes = await performGravity(board);
    await matchNonBombIndexesAndConvertBombs(board, newIndexes, matchIndexes);
  }
  document.documentElement.style.pointerEvents = null;
  return crushedDuringFirstCycle;
}

function createBoard(width, height) {
  document.documentElement.style.setProperty("--board-width", width);
  document.documentElement.style.setProperty("--board-height", height);
  const element = document.createElement("div");
  element.classList.add("board");
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
  const [row, column] = getCoordinates(emojiIndex, board);
  const tx = `calc((${column} + 0.5) * var(--square-size) - 50%)`;
  const ty = `calc((${row - rowDelta} + 0.5) * var(--square-size) - 50%)`;
  return `translate(${tx}, ${ty})`;
}

async function addEmoji(board, index, initialRowDelta = 0) {
  const element = document.createElement("div");
  element.classList.add("emoji");
  const position = calculateEmojiPosition(board, index, initialRowDelta);
  element.style.transform = position;
  element.dataset.emoji = Math.floor(Math.random() * numEmojis);
  board.emojis[index] = { element, position };
  board.emojisElement.appendChild(element);
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
  await performMatchCycle(board, coordinates);
}

startGame();
