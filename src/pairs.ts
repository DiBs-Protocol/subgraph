import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { PairCreated } from "../generated/PairFactoryUpgradeable/PairFactory";
import { Pair as ThePair } from "../generated/PairFactoryUpgradeable/Pair";

import {
  Pair,
  PathToTarget,
  TokenData,
  TokenToPair,
} from "../generated/schema";

const weth = Address.fromString("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1");

const TOKEN_DATA_ID = "TOKEN_DATA";

function addEdge(token: Address, pair: Pair): void {
  let tokenToPair = TokenToPair.load(token.toHex());
  if (!tokenToPair) {
    tokenToPair = new TokenToPair(token.toHex());
    tokenToPair.pairs = [];
  }
  const pairs = tokenToPair.pairs;
  pairs.push(pair.id);
  tokenToPair.pairs = pairs;
  tokenToPair.save();
}

function addToken(token: Address): void {
  // adds the token to TokenData scheme if not exists
  let tokenData = TokenData.load(TOKEN_DATA_ID);
  if (!tokenData) {
    tokenData = new TokenData(TOKEN_DATA_ID);
    tokenData.tokens = [];
  }

  const tokens = tokenData.tokens;

  if (!tokens.includes(token)) {
    tokens.push(token);
  }

  tokenData.tokens = tokens;
  tokenData.save();
}

function getTokens(): Address[] {
  let tokenData = TokenData.load(TOKEN_DATA_ID);
  if (!tokenData) {
    tokenData = new TokenData(TOKEN_DATA_ID);
    tokenData.tokens = [];
  }
  return tokenData.tokens.map<Address>((bytesAddress) =>
    Address.fromBytes(bytesAddress)
  );
}

function getPairs(token: Address): Pair[] {
  let tokenToPair = TokenToPair.load(token.toHex());
  if (!tokenToPair) {
    return [];
  } else {
    return tokenToPair.pairs.map<Pair>(
      (strPairAddress) => Pair.load(strPairAddress)!
    );
  }
}

function savePathToTarget(
  token: Address,
  target: Address,
  path: Address[]
): void {
  const id = token.toHex() + "-" + target.toHex();
  let pathToTarget = PathToTarget.load(id);
  if (!pathToTarget) {
    pathToTarget = new PathToTarget(id);
    pathToTarget.token = token;
    pathToTarget.target = target;
    pathToTarget.path = [];
  }

  pathToTarget.path = changetype<Bytes[]>(path);
  pathToTarget.save();
}

class IncomingPair {
  public parent: IncomingPair | null;
  public token: Address;
  public pair: Pair;

  constructor(parent_: IncomingPair | null, token_: Address, pair_: Pair) {
    this.parent = parent_;
    this.token = token_;
    this.pair = pair_;
  }
}

function PairsToIncomingPairs(
  parent: IncomingPair | null,
  token: Address,
  pairs: Pair[]
): IncomingPair[] {
  const _pairs: IncomingPair[] = [];
  for (let i = 0; i < pairs.length; i++) {
    _pairs.push(new IncomingPair(parent, token, pairs[i]));
  }
  return _pairs;
}

function calculatePathToTarget(token: Address, target: Address): void {
  let visited: Map<string, bool> = new Map<string, bool>();

  if (token == target) {
    savePathToTarget(token, target, [target]);
    return;
  }

  let fringe: Array<IncomingPair>;
  fringe = PairsToIncomingPairs(null, token, getPairs(token));

  while (fringe.length > 0) {
    const top = fringe.shift();
    const _token = top.token;
    const _pair = top.pair;

    visited.set(_pair.id, true);

    const otherToken = _pair.token0 == _token ? _pair.token1 : _pair.token0;

    if (otherToken == target) {
      const path: Address[] = [];
      let __parent: IncomingPair | null = top;
      while (__parent != null) {
        path.push(Address.fromString(__parent.pair.id));
        __parent = __parent.parent;
      }
      savePathToTarget(token, target, path.reverse());
      return;
    }

    // continue the search from otherToken
    const otherTokenPairs = getPairs(Address.fromBytes(otherToken));
    for (let i = 0; i < otherTokenPairs.length; i++) {
      if (!visited.has(otherTokenPairs[i].id)) {
        fringe.push(
          new IncomingPair(
            top,
            Address.fromBytes(otherToken),
            otherTokenPairs[i]
          )
        );
      }
    }
  }
}

export function handlePairCreated(event: PairCreated): void {
  // get the pair address
  const pairAddress = event.params.pair;
  // get the token0 address
  const token0Address = event.params.token0;
  // get the token1 address
  const token1Address = event.params.token1;

  // create an edge and add it to the tree
  // the edge will be from token0 to token1 and the pair address will be the edge id
  const pair = new Pair(pairAddress.toHex());
  pair.token0 = token0Address;
  pair.token1 = token1Address;
  pair.stable = event.params.stable;
  pair.save();

  // adjacency list
  addEdge(token0Address, pair);
  addEdge(token1Address, pair);

  addToken(token0Address);
  addToken(token1Address);

  const tokens = getTokens();

  tokens.forEach((token) => {
    calculatePathToTarget(token, weth);
  });
}
