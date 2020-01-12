const defaults = require('lodash/defaults');
const clone = require('lodash/clone');

function setDefault(map, k, v) {
  if (map.has(k)) {
    v = map.get(k)
  } else {
    map.set(k, v);
  }
  return v;
}

class Grid {

  constructor() {
    this.data = new Map();
    this.lb = 0;
    this.rb = 0;
  }

  add(pos, data) {
    const [row, col] = pos;
    setDefault(this.data, row, new Map()).set(col, data || {});
    if (col < this.lb) {
      this.lb = col;
    } else if (col > this.rb) {
      this.rb = col;
    }
  }

  get(pos) {
    const [row, col] = pos;
    const ref = this.data.get(row);
    if (!ref) {
      return;
    }
    return ref.get(col);
  }

  fill(from, to) {
    const [row1, col1] = to;
    const [row2, col2] = from;

    if (row1 > row2) {
      for (let i = row1; i >= row2; --i) {
        setDefault(setDefault(this.data, i, new Map()), col1, {});
      }
    } else if (row1 < row2) {
      for (let i = row1; i <= row2; ++i) {
        setDefault(setDefault(this.data, i, new Map()), col1, {});
      }
    }

    const ref = setDefault(this.data, row2, new Map());

    if (col1 > col2) {
      for (let i = col1; i >= col2; --i) {
        setDefault(ref, i, {});
      }
    } else if (col1 < col2) {
      for (let i = col1; i <= col2; ++i) {
        setDefault(ref, i, {});
      }
    }
  }
}

class Graph {

  constructor() {
    this.referrers = new Map();
    this.nodes = new Map()
  }

  layout(options) {
    options = defaults(options, {rankSep: 100, nodeSep: 30, marginX: 0, marginY: 0});

    const grid = new Grid();
    const ranks = this.assignRanks();

    for (let i = 0; i < ranks.length; ++i) {

      for (const nodeId of ranks[i]) {
        let bestCol = 0, minCrossing = null;

        for (let j = grid.lb - 1; j !== 0; ++j) {
          const c = this.crossing(nodeId, [i, j], grid);
          if (minCrossing === null || c <= minCrossing) {
            minCrossing = c;
            bestCol = j;
          }
        }

        for (let j = grid.rb + 1; j !== 0; --j) {
          const c = this.crossing(nodeId, [i, j], grid);
          if (minCrossing === null || c <= minCrossing) {
            minCrossing = c;
            bestCol = j;
          }
        }

        const c = this.crossing(nodeId, [i, 0], grid);
        if (minCrossing === null || c <= minCrossing) {
          bestCol = 0;
        }

        this.setNodeData(nodeId, {pos: [i, bestCol]});
        grid.add([i, bestCol], {node: true});

        for (const referrer of this.getNodeReferrers(nodeId)) {
          grid.fill(this.getNode(referrer).pos, [i, bestCol]);
        }
      }
    }

    this.calculatePosition(grid, options);
  }

  assignRanks() {
    const referrers = clone(this.referrers);
    const ranks = [];
    while (true) {
      const roots = Array.from(referrers.entries()).filter(([n, r]) => r.size === 0).map(([n, r]) => n);

      roots.forEach(key => referrers.delete(key));
      for (const refs of referrers.values()) {
        roots.forEach(key => refs.delete(key));
      }

      if (roots.length === 0) {
        break;
      }

      ranks.push(roots);
    }

    return ranks;
  }

  addNode(nodeId, data) {
    const ref = setDefault(this.nodes, nodeId, {});
    Object.assign(ref, data || {}, {id: nodeId});
    setDefault(this.referrers, nodeId, new Set());
  }

  setNodeData(nodeId, data) {
    const ref = this.nodes.get(nodeId);
    Object.assign(ref, data, {id: nodeId});
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  addEdge(from, to) {
    setDefault(this.referrers, to, new Set()).add(from);
  }

  getNodeReferrers(nodeId) {
    const referrers = this.referrers.get(nodeId);
    return referrers ? Array.from(referrers) : [];
  }

  calculatePosition(grid, options) {
    const offsetY = {};
    const offsetX = {};

    for (const node of this.nodes.values()) {
      const [row, col] = node.pos;
      if (!offsetY.hasOwnProperty(row)) {
        offsetY[row] = node.height;
      }
      if (!offsetX.hasOwnProperty(col)) {
        offsetX[col] = node.width;
      }
      if (node.height > offsetY[row]) {
        offsetY[row] = node.height;
      }
      if (node.width > offsetX[col]) {
        offsetX[col] = node.width;
      }
    }

    for (const node of this.nodes.values()) {
      const [row, col] = node.pos;
      let x = options.marginX, y = options.marginY;

      for (let i = 0; i < row; ++i) {
        y += offsetY[i] + options.rankSep;
      }

      for (let i = grid.lb; i < col; ++i) {
        x += offsetX[i] + options.nodeSep;
      }

      node.x = x + (offsetX[col] - node.width) / 2;
      node.y = y + (offsetY[row] - node.height) / 2;
    }
  }

  crossing(nodeId, pos, grid) {
    let counter = 0;
    const [row1, col1] = pos;

    for (const referrer of this.getNodeReferrers(nodeId)) {
      const [row2, col2] = this.getNode(referrer).pos;

      if (row1 > row2) {
        for (let i = row1; i > row2; --i) {
          const data = grid.get([i, col1]);
          if (data) {
            if (data.node) {
              return Infinity;
            }
            ++counter;
          }
        }
      } else if (row1 < row2) {
        for (let i = row1; i < row2; ++i) {
          const data = grid.get([i, col1]);
          if (data) {
            if (data.node) {
              return Infinity;
            }
            ++counter;
          }
        }
      }

      if (col1 > col2) {
        for (let i = col2 + 1; i <= col1; ++i) {
          const data = grid.get([row2, i]);
          if (data) {
            if (data.node) {
              return Infinity;
            }
            ++counter;
          }
        }
      } else if (col1 < col2) {
        for (let i = col2 - 1; i >= col1; --i) {
          const data = grid.get([row2, i]);
          if (data) {
            if (data.node) {
              return Infinity;
            }
            ++counter;
          }
        }
      }
    }

    return counter;
  }
}

// MAIN
const g = new Graph();
g.addNode('1', {width: 100, height: 60});
g.addNode('2', {width: 100, height: 60});
g.addNode('3', {width: 100, height: 60});
g.addNode('4', {width: 100, height: 60});
g.addNode('5', {width: 100, height: 60});
g.addNode(null, {width: 40, height: 40});
g.addEdge('1', '2');
g.addEdge('2', '3');
g.addEdge('3', '4');
g.addEdge('4', '5');
g.addEdge('1', '3');
g.addEdge('1', '4');
g.addEdge('1', '5');
g.addEdge('2', '4');
g.addEdge('2', '5');
g.addEdge('2', null);
g.addEdge('3', '5');
g.addEdge('3', null);
g.addEdge('4', null);
g.layout({marginX: 30, marginY: 30});
console.log(g.nodes);
