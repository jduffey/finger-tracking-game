import { useEffect, useMemo, useRef, useState } from "react";

const STARTING_BANKROLL = 1000;
const CHIP_VALUES = [1, 5, 25, 100];
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const OUTSIDE_BETS = [
  { id: "red", label: "Red", payout: 1, wins: (n) => n !== 0 && RED_NUMBERS.has(n) },
  { id: "black", label: "Black", payout: 1, wins: (n) => n !== 0 && !RED_NUMBERS.has(n) },
  { id: "even", label: "Even", payout: 1, wins: (n) => n !== 0 && n % 2 === 0 },
  { id: "odd", label: "Odd", payout: 1, wins: (n) => n % 2 === 1 },
  { id: "low", label: "1 to 18", payout: 1, wins: (n) => n >= 1 && n <= 18 },
  { id: "high", label: "19 to 36", payout: 1, wins: (n) => n >= 19 && n <= 36 },
  { id: "dozen1", label: "1st 12", payout: 2, wins: (n) => n >= 1 && n <= 12 },
  { id: "dozen2", label: "2nd 12", payout: 2, wins: (n) => n >= 13 && n <= 24 },
  { id: "dozen3", label: "3rd 12", payout: 2, wins: (n) => n >= 25 && n <= 36 },
  { id: "col1", label: "Column 1", payout: 2, wins: (n) => n !== 0 && n % 3 === 1 },
  { id: "col2", label: "Column 2", payout: 2, wins: (n) => n !== 0 && n % 3 === 2 },
  { id: "col3", label: "Column 3", payout: 2, wins: (n) => n !== 0 && n % 3 === 0 },
];

function sumChipValues(chips) {
  return chips.reduce((sum, chip) => sum + chip.value, 0);
}

function getNumberColor(number) {
  if (number === 0) {
    return "green";
  }
  return RED_NUMBERS.has(number) ? "red" : "black";
}

function getBetDefinition(betId) {
  if (betId.startsWith("number-")) {
    const number = Number.parseInt(betId.replace("number-", ""), 10);
    return {
      payout: 35,
      wins: (winningNumber) => winningNumber === number,
    };
  }

  return OUTSIDE_BETS.find((bet) => bet.id === betId);
}

function isCursorInsideRect(cursor, rect) {
  return (
    rect &&
    cursor.x >= rect.left &&
    cursor.x <= rect.right &&
    cursor.y >= rect.top &&
    cursor.y <= rect.bottom
  );
}

export default function RouletteFingerGame({ cursor, pinchActive, onBack }) {
  const [bankroll, setBankroll] = useState(STARTING_BANKROLL);
  const [bets, setBets] = useState({});
  const [lastResult, setLastResult] = useState(null);
  const [message, setMessage] = useState(
    "Use your finger cursor. Pinch on a chip to pick it up, move, release to drop.",
  );
  const [draggingChip, setDraggingChip] = useState(null);
  const [hoveredBetId, setHoveredBetId] = useState(null);

  const previousPinchRef = useRef(pinchActive);
  const betRefs = useRef({});
  const rackRefs = useRef({});
  const rackDropRef = useRef(null);
  const spinButtonRef = useRef(null);
  const clearButtonRef = useRef(null);
  const backButtonRef = useRef(null);

  const numberRows = useMemo(() => {
    const rows = [];
    for (let row = 0; row < 12; row += 1) {
      rows.push([row * 3 + 1, row * 3 + 2, row * 3 + 3]);
    }
    return rows;
  }, []);

  const totalStake = useMemo(
    () => Object.values(bets).reduce((sum, chips) => sum + sumChipValues(chips), 0),
    [bets],
  );

  const getBetIdAtCursor = (cursorPoint) => {
    const hovered = Object.entries(betRefs.current).find(([, node]) =>
      isCursorInsideRect(cursorPoint, node?.getBoundingClientRect()),
    );
    return hovered?.[0] ?? null;
  };

  useEffect(() => {
    setHoveredBetId(getBetIdAtCursor(cursor));
  }, [cursor]);

  useEffect(() => {
    const wasPinching = previousPinchRef.current;

    if (!wasPinching && pinchActive) {
      const overSpin = isCursorInsideRect(cursor, spinButtonRef.current?.getBoundingClientRect());
      const overClear = isCursorInsideRect(cursor, clearButtonRef.current?.getBoundingClientRect());
      const overBack = isCursorInsideRect(cursor, backButtonRef.current?.getBoundingClientRect());

      if (!draggingChip && overSpin) {
        spinWheel();
        previousPinchRef.current = pinchActive;
        return;
      }
      if (!draggingChip && overClear) {
        clearBets();
        previousPinchRef.current = pinchActive;
        return;
      }
      if (!draggingChip && overBack) {
        onBack();
        previousPinchRef.current = pinchActive;
        return;
      }

      const rackPick = Object.entries(rackRefs.current).find(([, node]) =>
        isCursorInsideRect(cursor, node?.getBoundingClientRect()),
      );
      const pickupBetId = getBetIdAtCursor(cursor);
      if (rackPick) {
        const chipValue = Number.parseInt(rackPick[0], 10);
        if (bankroll >= chipValue) {
          setBankroll((value) => value - chipValue);
          setDraggingChip({
            id: crypto.randomUUID(),
            value: chipValue,
            source: "rack",
            sourceBetId: null,
          });
          setMessage(`Picked up $${chipValue} chip.`);
        } else {
          setMessage("Not enough bankroll for that chip.");
        }
      } else if (pickupBetId && (bets[pickupBetId] ?? []).length > 0) {
        setBets((previous) => {
          const next = { ...previous };
          const chips = [...(next[pickupBetId] ?? [])];
          const chip = chips.pop();
          if (!chip) {
            return previous;
          }
          next[pickupBetId] = chips;
          if (chips.length === 0) {
            delete next[pickupBetId];
          }
          setDraggingChip({ ...chip, source: "bet", sourceBetId: pickupBetId });
          setMessage(`Picked chip from ${pickupBetId}.`);
          return next;
        });
      }
    }

    if (wasPinching && !pinchActive && draggingChip) {
      const dropBetId = getBetIdAtCursor(cursor);
      if (dropBetId) {
        setBets((previous) => ({
          ...previous,
          [dropBetId]: [...(previous[dropBetId] ?? []), { id: draggingChip.id, value: draggingChip.value }],
        }));
        setMessage(`Dropped $${draggingChip.value} chip on ${dropBetId}.`);
      } else if (isCursorInsideRect(cursor, rackDropRef.current?.getBoundingClientRect())) {
        setBankroll((value) => value + draggingChip.value);
        setMessage(`Returned $${draggingChip.value} chip to rack.`);
      } else if (draggingChip.source === "bet" && draggingChip.sourceBetId) {
        setBets((previous) => ({
          ...previous,
          [draggingChip.sourceBetId]: [
            ...(previous[draggingChip.sourceBetId] ?? []),
            { id: draggingChip.id, value: draggingChip.value },
          ],
        }));
        setMessage("Drop missed table spot, returned chip to its original bet.");
      } else {
        setBankroll((value) => value + draggingChip.value);
        setMessage("Drop missed table spot, returned chip to bankroll.");
      }
      setDraggingChip(null);
    }

    previousPinchRef.current = pinchActive;
  }, [bankroll, bets, cursor, draggingChip, hoveredBetId, pinchActive]);

  const spinWheel = () => {
    if (totalStake <= 0) {
      setMessage("Place at least one chip before spinning.");
      return;
    }

    const heldChipValue = draggingChip?.value ?? 0;
    const winningNumber = Math.floor(Math.random() * 37);
    const winningColor = getNumberColor(winningNumber);
    let payout = 0;

    Object.entries(bets).forEach(([betId, chips]) => {
      const definition = getBetDefinition(betId);
      if (!definition) {
        return;
      }
      const stake = sumChipValues(chips);
      if (definition.wins(winningNumber)) {
        payout += stake * (definition.payout + 1);
      }
    });

    setBankroll((value) => value + payout + heldChipValue);
    setBets({});
    setDraggingChip(null);
    setLastResult({ number: winningNumber, color: winningColor, payout });
    setMessage(payout > 0 ? `Win! Payout: $${payout}.` : "No winning bets this spin.");
  };

  const clearBets = () => {
    const heldChipValue = draggingChip?.value ?? 0;
    const refund = Object.values(bets).reduce((sum, chips) => sum + sumChipValues(chips), 0) + heldChipValue;
    setBankroll((value) => value + refund);
    setBets({});
    setDraggingChip(null);
    setMessage("All bets returned to bankroll.");
  };

  const renderBetCell = (betId, label, className = "") => {
    const chips = bets[betId] ?? [];
    const amount = sumChipValues(chips);
    return (
      <div
        key={betId}
        ref={(node) => {
          betRefs.current[betId] = node;
        }}
        className={`roulette-bet-cell ${className} ${hoveredBetId === betId ? "hovered" : ""}`.trim()}
      >
        <div className="roulette-bet-label">{label}</div>
        <div className="roulette-chip-count">{chips.length} chips</div>
        {amount > 0 && <div className="roulette-bet-amount">${amount}</div>}
      </div>
    );
  };

  return (
    <section className="card panel roulette-panel">
      <h2>Finger Roulette</h2>
      <p className="small-text">Pinch and hold to drag chips with your tracked finger, release to drop.</p>
      <div className="roulette-table-grid">
        <div className="roulette-zero-column">{renderBetCell("number-0", "0", "zero")}</div>
        <div className="roulette-number-grid">
          {numberRows.map((row) => (
            <div key={`row-${row[0]}`} className="roulette-number-row">
              {row.map((number) =>
                renderBetCell(
                  `number-${number}`,
                  String(number),
                  RED_NUMBERS.has(number) ? "red" : "black",
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="roulette-outside-grid">
        {OUTSIDE_BETS.map((bet) => renderBetCell(bet.id, `${bet.label} (${bet.payout}:1)`))}
      </div>

      <div className="roulette-status-row">
        <span>Bankroll: ${bankroll}</span>
        <span>Stake: ${totalStake}</span>
        <span>Pinch: {pinchActive ? "holding" : "released"}</span>
        {lastResult && <span>Last: {lastResult.number} ({lastResult.color})</span>}
      </div>

      <p className="small-text">{message}</p>

      <div className="roulette-chip-rack">
        {CHIP_VALUES.map((value) => (
          <div
            key={value}
            ref={(node) => {
              rackRefs.current[String(value)] = node;
            }}
            className="roulette-rack-chip"
          >
            ${value}
          </div>
        ))}
        <div
          ref={rackDropRef}
          className="roulette-rack-drop"
        >
          Release chip here to return
        </div>
      </div>

      <div className="roulette-spin-row">
        <button ref={spinButtonRef} className="roulette-spin-button" type="button" onClick={spinWheel}>
          Spin Wheel
        </button>
      </div>

      <div className="button-row roulette-actions-row">
        <button
          ref={clearButtonRef}
          className="secondary"
          type="button"
          onClick={clearBets}
        >
          Clear Bets
        </button>
        <button
          ref={backButtonRef}
          className="secondary"
          type="button"
          onClick={onBack}
        >
          Back to Main Game
        </button>
      </div>

      {draggingChip && (
        <div
          className="roulette-dragging-chip"
          style={{ left: `${cursor.x}px`, top: `${cursor.y}px` }}
        >
          ${draggingChip.value}
        </div>
      )}
    </section>
  );
}
