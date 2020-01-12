const forOwn = require('lodash/forOwn');
const isEqual = require('lodash/isEqual');
const max = require('lodash/max');
const min = require('lodash/min');

function fillPath(grid, from, to) {
  const [row1, col1] = to;
  const [row2, col2] = from;

  if (row1 > row2) {
    for (let i = row1; i >= row2; --i) {
      setDefault(grid, i, new Set()).add(col1);
    }
  } else if (row1 < row2) {
    for (let i = row1; i <= row2; ++i) {
      setDefault(grid, i, new Set()).add(col1);
    }
  }

  const v = setDefault(grid, row2, new Set());

  if (col1 > col2) {
    for (let i = col1; i >= col2; --i) {
      v.add(i);
    }
  } else if (col1 < col2) {
    for (let i = col1; i <= col2; ++i) {
      v.add(i);
    }
  }
}

function isRankSet(grid, rank) {
  const [row, col] = rank;
  if (!grid.has(row)) {
    return false;
  }
  return grid.get(row).has(col);
}

function isRankAssigned(assignedRanks, rank) {
  for (const key of Object.getOwnPropertyNames(assignedRanks)) {
    if (isEqual(rank, assignedRanks[key].rank)) {
      return true;
    }
  }
  return false;
}

function crossing(grid, rank, referrers, assignedRanks) {
  let counter = 0;
  const [row1, col1] = rank;

  for (const referrer of referrers.values()) {
    const [row2, col2] = assignedRanks[referrer].rank;

    if (row1 > row2) {
      for (let i = row1; i > row2; --i) {
        if (isRankSet(grid, [i, col1])) {
          if (isRankAssigned(assignedRanks, [i, col1])) {
            return Infinity;
          }
          ++counter;
        }
      }
    } else if (row1 < row2) {
      for (let i = row1; i < row2; ++i) {
        if (isRankSet(grid, [i, col1])) {
          if (isRankAssigned(assignedRanks, [i, col1])) {
            return Infinity;
          }
          ++counter;
        }
      }
    }


    if (col1 > col2) {
      for (let i = col2 + 1; i <= col1; ++i) {
        if (isRankSet(grid, [row2, i])) {
          if (isRankAssigned(assignedRanks, [row2, i])) {
            return Infinity;
          }
          ++counter;
        }
      }
    } else if (col1 < col2) {
      for (let i = col2 - 1; i >= col1; --i) {
        if (isRankSet(grid, [row2, i])) {
          if (isRankAssigned(assignedRanks, [row2, i])) {
            return Infinity;
          }
          ++counter;
        }
      }
    }
  }

  return counter;
}

const SCREEN_OUT = 'screen-out';

function setDefault(map, k, v) {
  if (map.has(k)) {
    v = map.get(k)
  } else {
    map.set(k, v);
  }
  return v;
}

function layout(assignedRanks, pages, routing, rankSep = 100, nodeSep = 30) {
  const formElementToPage = new Map();

  for (const page of pages) {
    for (const formElement of page.formElements) {
      formElementToPage.set(formElement.id, page.id);
    }
  }

  const pageToReferrers = new Map();

  forOwn(routing, (routes, formElementId) => {
    for (const route of routes) {
      setDefault(pageToReferrers, route.target || SCREEN_OUT, new Set()).add(formElementToPage.get(formElementId));
    }
  });

  const grid = new Map();
  let nextLeftBoundary = -1, nextRightBoundary = 1;

  for (let i = 0; i < pages.length; ++i) {
    const pageId = pages[i].id;
    const referrers = pageToReferrers.get(pageId) || new Set();

    let bestCol = 0;
    let minCrossing = null;

    for (let j = nextLeftBoundary; j !== 0; ++j) {
      const c = crossing(grid, [i, j], referrers, assignedRanks);
      if (minCrossing === null || c <= minCrossing) {
        minCrossing = c;
        bestCol = j;
      }
    }

    for (let j = nextRightBoundary; j !== 0; --j) {
      const c = crossing(grid, [i, j], referrers, assignedRanks);
      if (minCrossing === null || c <= minCrossing) {
        minCrossing = c;
        bestCol = j;
      }
    }

    const c = crossing(grid, [i, 0], referrers, assignedRanks);
    if (minCrossing === null || c <= minCrossing) {
      bestCol = 0;
    }

    if (bestCol < 0) {
      nextLeftBoundary = bestCol - 1;

    } else if (bestCol > 0) {
      nextRightBoundary = bestCol + 1
    }

    assignedRanks[pageId].rank = [i, bestCol];
    grid.set(i, new Set([bestCol]));

    for (const referrer of referrers.values()) {
      fillPath(grid, assignedRanks[referrer].rank, [i, bestCol]);
    }

    if (i !== 0) {
      const [row, col] = assignedRanks[pages[i - 1].id].rank;
      fillPath(grid, [row + 1, col], [i, bestCol]);
    }
  }

  if (pageToReferrers.has(SCREEN_OUT)) {
    const referrers = pageToReferrers.get(SCREEN_OUT);
    const pageIndexes = pages.map(p => p.id);
    const index = max(Array.from(referrers).map(pageId => pageIndexes.indexOf(pageId))) + 1;

    const r = Array.from(grid.get(index));
    const lb = min(r) - 1;
    const rb = max(r) + 1;

    let bestCol = 0;
    let minCrossing = null;

    for (let j = lb; j !== 0; ++j) {
      const c = crossing(grid, [index, j], referrers, assignedRanks);
      if (minCrossing === null || c <= minCrossing) {
        minCrossing = c;
        bestCol = j;
      }
    }

    for (let j = rb; j !== 0; --j) {
      const c = crossing(grid, [index, j], referrers, assignedRanks);
      if (minCrossing === null || c <= minCrossing) {
        minCrossing = c;
        bestCol = j;
      }
    }

    const c = crossing(grid, [index, 0], referrers, assignedRanks);
    if (minCrossing === null || c <= minCrossing) {
      bestCol = 0;
    }

    assignedRanks[SCREEN_OUT].rank = [index, bestCol];
  }

  const rowDim = {};
  const colDim = {};

  forOwn(assignedRanks, props => {
    const [row, col] = props.rank;
    if (rowDim[row] == null) {
      rowDim[row] = props.height;
    }
    if (colDim[col] == null) {
      colDim[col] = props.width;
    }
    if (props.height > rowDim[row]) {
      rowDim[row] = props.height;
    }
    if (props.width > colDim[col]) {
      colDim[col] = props.width;
    }
  });

  forOwn(assignedRanks, props => {
    const [row, col] = props.rank;
    let startX = 0, startY = 0;
    for (let i = 0; i < row; ++i) {
      startY += rowDim[i] + rankSep;
    }
    for (let i = nextLeftBoundary; i < col; ++i) {
      startX += colDim[i] + nodeSep;
    }
    props.x = startX + (colDim[col] - props.width) / 2;
    props.y = startY + (rowDim[row] - props.height) / 2;
  });

  return assignedRanks;
}

const pages = [
  {id: '1', formElements: [{id: '1'}]},
  {id: '2', formElements: [{id: '2'}]},
  {id: '3', formElements: [{id: '3'}]},
  {id: '4', formElements: [{id: '4'}]},
  {id: '5', formElements: []}
];

const routing = {
  '1': [{target: '3'}, {target: '4'}, {target: '5'}],
  '2': [{target: '4'}, {target: '5'}, {target: null}],
  '3': [{target: '5'}, {target: null}],
  '4': [{target: null}]
};

const assignedRanks = {
  '1': {width: 50, height: 60},
  '2': {width: 100, height: 60},
  '3': {width: 100, height: 60},
  '4': {width: 100, height: 60},
  '5': {width: 100, height: 60},
  [SCREEN_OUT]: {width: 100, height: 30},
};

console.log(layout(assignedRanks, pages, routing));
