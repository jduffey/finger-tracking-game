import { useMemo, useState } from "react";

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

function getNumberColor(number) {
  if (number === 0) {
    return "green";
  }
  return RED_NUMBERS.has(number) ? "red" : "black";
}

function getBetDefinition(betId) {
  if (betId.startsWith("number-")) {
    const target = Number.parseInt(betId.replace("number-", ""), 10);
    return {
      label: `${target}`,
      payout: 35,
      wins: (winningNumber) => winningNumber === target,
    };
  }
  return OUTSIDE_BETS.find((bet) => bet.id === betId);
}

function sumChipValues(chips) {
  return chips.reduce((sum, chip) => sum + chip.value, 0);
}

function parseDragData(event) {
  const raw = event.dataTransfer.getData("application/json");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function RouletteGame() {
  const [bankroll, setBankroll] = useState(STARTING_BANKROLL);
  const [bets, setBets] = useState({});
  const [lastResult, setLastResult] = useState(null);
  const [spinMessage, setSpinMessage] = useState("Place your bets and spin the wheel.");

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

  const placeChip = (betId, chip) => {
    setBets((previous) => ({
      ...previous,
      [betId]: [...(previous[betId] ?? []), chip],
    }));
  };

  const handleDropOnBet = (event, betId) => {
    event.preventDefault();
    const payload = parseDragData(event);
    if (!payload) {
      return;
    }

    if (payload.source === "rack") {
      if (bankroll < payload.value) {
        setSpinMessage("Not enough bankroll for that chip.");
        return;
      }
      setBankroll((value) => value - payload.value);
      placeChip(betId, {
        id: crypto.randomUUID(),
        value: payload.value,
      });
      return;
    }

    if (payload.source === "bet") {
      setBets((previous) => {
        const next = { ...previous };
        const fromChips = [...(next[payload.betId] ?? [])];
        const chipIndex = fromChips.findIndex((chip) => chip.id === payload.chipId);
        if (chipIndex < 0) {
          return previous;
        }
        const [chip] = fromChips.splice(chipIndex, 1);
        next[payload.betId] = fromChips;
        if (next[payload.betId].length === 0) {
          delete next[payload.betId];
        }
        next[betId] = [...(next[betId] ?? []), chip];
        return next;
      });
    }
  };

  const handleDropOnRack = (event) => {
    event.preventDefault();
    const payload = parseDragData(event);
    if (!payload || payload.source !== "bet") {
      return;
    }

    setBets((previous) => {
      const next = { ...previous };
      const fromChips = [...(next[payload.betId] ?? [])];
      const chipIndex = fromChips.findIndex((chip) => chip.id === payload.chipId);
      if (chipIndex < 0) {
        return previous;
      }
      const [chip] = fromChips.splice(chipIndex, 1);
      setBankroll((value) => value + chip.value);
      next[payload.betId] = fromChips;
      if (next[payload.betId].length === 0) {
        delete next[payload.betId];
      }
      return next;
    });
  };

  const spinWheel = () => {
    if (totalStake === 0) {
      setSpinMessage("Please place at least one chip before spinning.");
      return;
    }

    const winningNumber = Math.floor(Math.random() * 37);
    const winningColor = getNumberColor(winningNumber);

    let totalPayout = 0;
    Object.entries(bets).forEach(([betId, chips]) => {
      const definition = getBetDefinition(betId);
      if (!definition) {
        return;
      }

      const stake = sumChipValues(chips);
      if (definition.wins(winningNumber)) {
        totalPayout += stake * (definition.payout + 1);
      }
    });

    setBankroll((value) => value + totalPayout);
    setBets({});
    setLastResult({ number: winningNumber, color: winningColor, payout: totalPayout });

    if (totalPayout > 0) {
      setSpinMessage(`Win! Payout: $${totalPayout}.`);
    } else {
      setSpinMessage("No winning bets this spin.");
    }
  };

  const clearBets = () => {
    const refund = Object.values(bets).reduce((sum, chips) => sum + sumChipValues(chips), 0);
    setBankroll((value) => value + refund);
    setBets({});
    setSpinMessage("All bets cleared and refunded.");
  };

  const renderBetCell = (betId, label, extraClass = "") => {
    const chips = bets[betId] ?? [];
    const amount = sumChipValues(chips);

    return (
      <div
        key={betId}
        className={`bet-cell ${extraClass}`.trim()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDropOnBet(event, betId)}
      >
        <div className="bet-label">{label}</div>
        <div className="bet-chip-stack">
          {chips.map((chip) => (
            <div
              key={chip.id}
              draggable
              className="chip chip-placed"
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/json",
                  JSON.stringify({
                    source: "bet",
                    betId,
                    chipId: chip.id,
                  }),
                );
              }}
            >
              ${chip.value}
            </div>
          ))}
        </div>
        {amount > 0 && <div className="bet-amount">${amount}</div>}
      </div>
    );
  };

  return (
    <main className="roulette-page">
      <header className="roulette-header">
        <h1>Roulette Table</h1>
        <p>European roulette rules: single zero, inside bets pay 35:1, outside bets pay 1:1 or 2:1.</p>
      </header>

      <section className="roulette-status">
        <div><strong>Bankroll:</strong> ${bankroll}</div>
        <div><strong>Current stake:</strong> ${totalStake}</div>
        {lastResult && (
          <div>
            <strong>Last spin:</strong> {lastResult.number} ({lastResult.color})
          </div>
        )}
      </section>

      <section className="roulette-controls">
        <button type="button" onClick={spinWheel}>Spin Wheel</button>
        <button type="button" onClick={clearBets}>Clear Bets</button>
        <span>{spinMessage}</span>
      </section>

      <section className="chip-rack-wrap">
        <h2>Chip Rack (drag chips onto betting areas)</h2>
        <div className="chip-rack">
          {CHIP_VALUES.map((chipValue) => (
            <div
              key={chipValue}
              draggable
              className="chip chip-rack"
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/json",
                  JSON.stringify({ source: "rack", value: chipValue }),
                );
              }}
            >
              ${chipValue}
            </div>
          ))}
          <div
            className="chip-return"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDropOnRack}
          >
            Drag here to remove chip
          </div>
        </div>
      </section>

      <section className="roulette-table">
        <div className="zero-cell-wrap">{renderBetCell("number-0", "0", "zero-cell")}</div>
        <div className="number-grid">
          {numberRows.map((row) => (
            <div key={`row-${row[0]}`} className="number-row">
              {row.map((number) =>
                renderBetCell(
                  `number-${number}`,
                  `${number}`,
                  RED_NUMBERS.has(number) ? "number-red" : "number-black",
                ),
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="outside-bets-grid">
        {OUTSIDE_BETS.map((bet) => renderBetCell(bet.id, `${bet.label} (${bet.payout}:1)`))}
      </section>
    </main>
  );
}
