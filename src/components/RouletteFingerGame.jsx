import { useMemo, useState } from "react";

import {
  PROBABILITY_BATCH_SIZES,
  PROBABILITY_EVENTS,
  createProbabilityBatch,
  getExpectedHitCount,
  getProbabilityEvent,
  getProbabilityIndependenceInsight,
  summarizeProbabilityBatches,
} from "../probabilityExperiment.js";
import "./ProbabilityTable.css";

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function formatExpectedHits(value) {
  return Number(value).toFixed(value >= 10 ? 1 : 2);
}

function PredictionScale({
  eventId,
  trialCount,
  predictedHits,
  onChange,
}) {
  const expectedHits = getExpectedHitCount(eventId, trialCount);
  return (
    <div className="probability-prediction">
      <div className="probability-control-heading">
        <div>
          <span className="probability-step">3</span>
          <div>
            <strong>Make a prediction</strong>
            <small>
              Expected value: about {formatExpectedHits(expectedHits)} hits
            </small>
          </div>
        </div>
        <output htmlFor="probability-prediction-input">
          {predictedHits} hit{predictedHits === 1 ? "" : "s"}
        </output>
      </div>
      <input
        aria-describedby="probability-prediction-help"
        id="probability-prediction-input"
        max={trialCount}
        min="0"
        onChange={(event) => onChange(Number(event.target.value))}
        step="1"
        type="range"
        value={predictedHits}
      />
      <div aria-hidden="true" className="probability-scale-labels">
        <span>0</span>
        <span>{Math.round(trialCount / 2)}</span>
        <span>{trialCount}</span>
      </div>
      <p id="probability-prediction-help">
        Move the slider to predict how many trials will match your event.
      </p>
    </div>
  );
}

function BatchResult({ batch, event }) {
  if (!batch) {
    return (
      <div className="probability-empty-result">
        <span aria-hidden="true">◎</span>
        <strong>Your result will appear here</strong>
        <p>
          Lock a prediction, run the trials, then compare chance with what
          actually happened.
        </p>
      </div>
    );
  }

  const predictionGap = batch.hits - batch.predictedHits;
  const predictionCopy =
    predictionGap === 0
      ? "Exactly right"
      : `${Math.abs(predictionGap)} ${predictionGap > 0 ? "more" : "fewer"} than predicted`;
  return (
    <section
      aria-labelledby="probability-latest-result-title"
      className="probability-latest-result"
    >
      <p className="probability-kicker">Latest experiment</p>
      <h3 id="probability-latest-result-title">
        {event.shortLabel} appeared {batch.hits} time
        {batch.hits === 1 ? "" : "s"}
      </h3>
      <div className="probability-result-comparison">
        <div>
          <span>You predicted</span>
          <strong>{batch.predictedHits}</strong>
          <small>{predictionCopy}</small>
        </div>
        <div>
          <span>Chance suggests</span>
          <strong>{formatExpectedHits(batch.expectedHits)}</strong>
          <small>{formatPercent(batch.expectedProbability)} each trial</small>
        </div>
        <div className="is-observed">
          <span>You observed</span>
          <strong>{batch.hits}</strong>
          <small>{formatPercent(batch.observedProbability)} this batch</small>
        </div>
      </div>
    </section>
  );
}

function OutcomeHistory({ outcomes, eventLabel }) {
  if (outcomes.length === 0) {
    return null;
  }
  const visibleOutcomes = outcomes.slice(-24).reverse();
  return (
    <section
      aria-labelledby="probability-history-title"
      className="probability-history"
    >
      <div>
        <p className="probability-kicker">Most recent first</p>
        <h3 id="probability-history-title">Outcome trail</h3>
      </div>
      <ol aria-label={`Recent outcomes for ${eventLabel}`}>
        {visibleOutcomes.map((outcome, index) => (
          <li
            className={`is-${outcome.color}${outcome.hit ? " is-hit" : ""}`}
            key={`${outcomes.length - index}-${outcome.number}`}
          >
            <span>{outcome.number}</span>
            <small>{outcome.hit ? "match" : "miss"}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function ProbabilityTable({ onBack }) {
  const [eventId, setEventId] = useState(PROBABILITY_EVENTS[0].id);
  const [trialCount, setTrialCount] = useState(PROBABILITY_BATCH_SIZES[0]);
  const [predictedHits, setPredictedHits] = useState(() =>
    Math.round(
      getExpectedHitCount(
        PROBABILITY_EVENTS[0].id,
        PROBABILITY_BATCH_SIZES[0],
      ),
    ),
  );
  const [batches, setBatches] = useState([]);
  const [announcement, setAnnouncement] = useState(
    "Choose an event, batch size, and prediction.",
  );

  const event = getProbabilityEvent(eventId);
  const summary = useMemo(
    () => summarizeProbabilityBatches(batches, eventId),
    [batches, eventId],
  );
  const latestBatch = batches.at(-1) ?? null;
  const independenceInsight = getProbabilityIndependenceInsight(
    summary.outcomes,
  );

  function resetPrediction(nextEventId, nextTrialCount) {
    setPredictedHits(
      Math.round(getExpectedHitCount(nextEventId, nextTrialCount)),
    );
  }

  function selectEvent(nextEventId) {
    setEventId(nextEventId);
    setBatches([]);
    resetPrediction(nextEventId, trialCount);
    const nextEvent = getProbabilityEvent(nextEventId);
    setAnnouncement(
      `${nextEvent.label} selected. Its expected probability is ${formatPercent(
        nextEvent.favorableOutcomes / 37,
      )}.`,
    );
  }

  function selectTrialCount(nextTrialCount) {
    setTrialCount(nextTrialCount);
    setBatches([]);
    resetPrediction(eventId, nextTrialCount);
    setAnnouncement(`${nextTrialCount} trials selected.`);
  }

  function runBatch() {
    const batch = createProbabilityBatch({
      eventId,
      trialCount,
      predictedHits,
    });
    setBatches((current) => [...current, batch].slice(-12));
    setAnnouncement(
      `${event.label} appeared ${batch.hits} times in ${batch.trialCount} trials. You predicted ${batch.predictedHits}.`,
    );
  }

  function resetExperiment() {
    setBatches([]);
    resetPrediction(eventId, trialCount);
    setAnnouncement("Experiment reset. Make a new prediction.");
  }

  return (
    <section
      aria-labelledby="probability-table-title"
      className="card panel probability-panel"
    >
      <header className="probability-header">
        <div>
          <p className="probability-kicker">Hands-on chance lab</p>
          <h2 id="probability-table-title">Probability Table</h2>
          <p>
            Predict a pattern, run a finite wheel experiment, and see why a
            small sample rarely looks exactly like the long-run odds.
          </p>
        </div>
        <button className="secondary" onClick={onBack} type="button">
          Home
        </button>
      </header>

      <div className="probability-workspace">
        <section
          aria-labelledby="probability-controls-title"
          className="probability-controls"
        >
          <h3
            id="probability-controls-title"
            className="probability-sr-only"
          >
            Build an experiment
          </h3>

          <fieldset className="probability-choice-group">
            <legend>
              <span className="probability-step">1</span>
              Pick an event
            </legend>
            <div className="probability-event-grid">
              {PROBABILITY_EVENTS.map((option) => (
                <button
                  aria-pressed={eventId === option.id}
                  className={eventId === option.id ? "is-selected" : ""}
                  key={option.id}
                  onClick={() => selectEvent(option.id)}
                  type="button"
                >
                  <strong>{option.shortLabel}</strong>
                  <span>
                    {option.favorableOutcomes}/37 ·{" "}
                    {formatPercent(option.favorableOutcomes / 37)}
                  </span>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="probability-choice-group">
            <legend>
              <span className="probability-step">2</span>
              Choose a sample size
            </legend>
            <div
              aria-label="Number of trials"
              className="probability-batch-picker"
              role="group"
            >
              {PROBABILITY_BATCH_SIZES.map((size) => (
                <button
                  aria-pressed={trialCount === size}
                  className={trialCount === size ? "is-selected" : ""}
                  key={size}
                  onClick={() => selectTrialCount(size)}
                  type="button"
                >
                  <strong>{size}</strong>
                  <span>trials</span>
                </button>
              ))}
            </div>
          </fieldset>

          <PredictionScale
            eventId={eventId}
            onChange={setPredictedHits}
            predictedHits={predictedHits}
            trialCount={trialCount}
          />

          <button
            className="primary probability-run-button"
            onClick={runBatch}
            type="button"
          >
            Run {trialCount} trials
          </button>
        </section>

        <div className="probability-results-column">
          <BatchResult batch={latestBatch} event={event} />

          {summary.trialCount > 0 ? (
            <section
              aria-labelledby="probability-cumulative-title"
              className="probability-cumulative"
            >
              <div>
                <p className="probability-kicker">
                  Across {summary.batches} batch
                  {summary.batches === 1 ? "" : "es"}
                </p>
                <h3 id="probability-cumulative-title">
                  Longer-run comparison
                </h3>
              </div>
              <dl>
                <div>
                  <dt>Trials</dt>
                  <dd>{summary.trialCount}</dd>
                </div>
                <div>
                  <dt>Matches</dt>
                  <dd>{summary.hits}</dd>
                </div>
                <div>
                  <dt>Observed</dt>
                  <dd>{formatPercent(summary.observedProbability)}</dd>
                </div>
                <div>
                  <dt>Expected</dt>
                  <dd>{formatPercent(summary.expectedProbability)}</dd>
                </div>
              </dl>
              <div className="probability-meter" aria-hidden="true">
                <span
                  className="probability-meter-expected"
                  style={{
                    left: `${summary.expectedProbability * 100}%`,
                  }}
                />
                <span
                  className="probability-meter-observed"
                  style={{
                    left: `${summary.observedProbability * 100}%`,
                  }}
                />
              </div>
              <div className="probability-meter-legend">
                <span>◆ Observed</span>
                <span>│ Expected</span>
              </div>
            </section>
          ) : null}

          {independenceInsight ? (
            <aside className="probability-insight">
              <strong>Streak check</strong>
              <p>{independenceInsight}</p>
            </aside>
          ) : (
            <aside className="probability-insight">
              <strong>What to watch</strong>
              <p>
                Try the same event several times. The observed percentage can
                swing in short batches, then often drifts toward the expected
                value as the sample grows.
              </p>
            </aside>
          )}
        </div>
      </div>

      <OutcomeHistory
        eventLabel={event.label}
        outcomes={summary.outcomes}
      />

      {summary.trialCount > 0 ? (
        <div className="probability-footer-actions">
          <button className="secondary" onClick={resetExperiment} type="button">
            Reset experiment
          </button>
          <p>
            Every trial uses the same 37 equally likely outcomes. No money,
            prizes, or wagering.
          </p>
        </div>
      ) : null}

      <p
        aria-atomic="true"
        aria-live="polite"
        className="probability-sr-only"
        role="status"
      >
        {announcement}
      </p>
    </section>
  );
}
