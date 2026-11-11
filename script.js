(() => {
  "use strict";

  // Three concrete six-word lists. The experiment randomly assigns lists to strategies.
  const wordLists = [
    ["apple", "hammer", "river", "candle", "tiger", "window"],
    ["garden", "pencil", "mountain", "chair", "orange", "guitar"],
    ["bread", "bridge", "rabbit", "bottle", "school", "flower"]
  ];

  const strategies = [
    {
      key: "maintenance_rehearsal",
      label: "Maintenance rehearsal",
      instructions: "Repeat each word silently to yourself while it is on the screen. Focus on keeping the word active in short-term memory by repeating it.",
      example: "Example: for “apple,” silently repeat “apple, apple, apple…”"
    },
    {
      key: "self_reference",
      label: "Self-reference",
      instructions: "Think about how each word relates to you personally. Form a quick personal connection, memory, preference, or experience involving the word.",
      example: "Example: for “apple,” think about whether you like apples, when you last ate one, or a personal memory involving apples."
    },
    {
      key: "mental_imagery",
      label: "Mental imagery",
      instructions: "Create a vivid mental picture of the object or thing represented by each word. Imagine its shape, color, size, location, or movement.",
      example: "Example: for “apple,” picture a bright red apple in your hand."
    }
  ];

  const WORD_MS = 700;
  const DISTRACTOR_MS = 30000;

  let state = null;
  let distractorTimer = null;
  let studyTimer = null;

  const $ = id => document.getElementById(id);
  const show = id => $(id).classList.remove("hidden");
  const hide = id => $(id).classList.add("hidden");

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randomThreeDigit() {
    return Math.floor(100 + Math.random() * 900);
  }

  function escapeCsv(value) {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
  }

  function download(filename, content) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Normalize text for case-insensitive scoring.
  function normalize(s) {
    return String(s)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      const cur = [i + 1];
      for (let j = 0; j < b.length; j++) {
        const ins = cur[j] + 1;
        const del = prev[j + 1] + 1;
        const sub = prev[j] + (a[i] === b[j] ? 0 : 1);
        cur.push(Math.min(ins, del, sub));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // A conservative typo tolerance: exact match, or small edit distance for short words.
  function matchesTarget(response, target) {
    const r = normalize(response), t = normalize(target);
    if (!r || !t) return false;
    if (r === t) return true;
    const d = levenshtein(r, t);
    const maxDistance = t.length <= 4 ? 1 : t.length <= 7 ? 1 : 2;
    return d <= maxDistance && d / Math.max(r.length, t.length) <= 0.25;
  }

  function scoreRecall(responseText) {
    // Preserve duplicates only for analysis; each target can receive credit once.
    const responses = responseText
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const usedTargets = new Set();
    const trialRows = state.trials.map(trial => {
      let recalled = false;
      let matchedResponse = "";
      for (const response of responses) {
        if (usedTargets.has(trial.word)) continue;
        if (matchesTarget(response, trial.word)) {
          recalled = true;
          matchedResponse = response;
          usedTargets.add(trial.word);
          break;
        }
      }
      return {...trial, recalled, matchedResponse};
    });

    return trialRows;
  }

  function initState() {
    const shuffledStrategies = shuffle(strategies);
    const shuffledLists = shuffle(wordLists);
    const participantId = $("participantId").value.trim() || `anonymous-${Date.now()}`;

    const blocks = shuffledStrategies.map((strategy, i) => ({
      strategy,
      words: shuffledLists[i]
    }));

    state = {
      participantId,
      sessionId: new Date().toISOString().replace(/[:.]/g, "-"),
      startedAt: new Date().toISOString(),
      blocks,
      blockIndex: 0,
      wordIndex: 0,
      trials: [],
      distractorStart: null,
      distractorEnd: null,
      startingNumber: null,
      distractorResponse: "",
      recallText: "",
      results: null
    };
  }

  function startExperiment() {
    initState();
    hide("intro"); hide("results"); hide("distractor"); hide("recall");
    show("instructions");
    renderInstructions();
  }

  function renderInstructions() {
    const block = state.blocks[state.blockIndex];
    $("blockProgress").textContent = `Block ${state.blockIndex + 1} of 3`;
    $("instructionTitle").textContent = block.strategy.label;
    $("instructionText").textContent = block.strategy.instructions;
    $("strategyExample").textContent = block.strategy.example;
    $("continueBtn").textContent = "Start block";
  }

  function startBlock() {
    hide("instructions");
    show("study");
    state.wordIndex = 0;
    showCurrentWord();
  }

  function showCurrentWord() {
    const block = state.blocks[state.blockIndex];
    const word = block.words[state.wordIndex];
    $("studyProgress").textContent = `Word ${state.wordIndex + 1} of 6`;
    $("studyStrategy").textContent = block.strategy.label;
    $("word").textContent = word;

    clearTimeout(studyTimer);
    studyTimer = setTimeout(() => {
      state.trials.push({
        block: state.blockIndex + 1,
        strategy: block.strategy.key,
        strategyLabel: block.strategy.label,
        word,
        wordPosition: state.wordIndex + 1,
        recalled: false,
        matchedResponse: ""
      });
      state.wordIndex++;
      if (state.wordIndex < 6) {
        showCurrentWord();
      } else {
        state.blockIndex++;
        if (state.blockIndex < 3) {
          show("instructions"); hide("study");
          renderInstructions();
        } else {
          startDistractor();
        }
      }
    }, WORD_MS);
  }

  function startDistractor() {
    hide("study"); hide("instructions");
    show("distractor");
    const start = randomThreeDigit();
    state.startingNumber = start;
    state.distractorStart = new Date().toISOString();
    $("startingNumber").textContent = start;
    $("distractorInput").value = "";
    $("distractorInput").focus();

    let remaining = DISTRACTOR_MS / 1000;
    $("timer").textContent = remaining;
    clearInterval(distractorTimer);
    distractorTimer = setInterval(() => {
      remaining--;
      $("timer").textContent = Math.max(0, remaining);
      if (remaining <= 0) {
        clearInterval(distractorTimer);
        state.distractorEnd = new Date().toISOString();
        state.distractorResponse = $("distractorInput").value;
        hide("distractor");
        show("recall");
        $("recallInput").focus();
      }
    }, 1000);
  }

  function scoreExperiment() {
    state.recallText = $("recallInput").value;
    state.results = scoreRecall(state.recallText);
    state.endedAt = new Date().toISOString();
    renderResults();
  }

  function renderResults() {
    hide("recall");
    show("results");

    const counts = {};
    strategies.forEach(s => counts[s.key] = {label: s.label, recalled: 0, total: 0});
    state.results.forEach(t => {
      counts[t.strategy].total++;
      if (t.recalled) counts[t.strategy].recalled++;
    });

    const total = state.results.filter(t => t.recalled).length;
    $("resultSummary").innerHTML =
      `<strong>${total} of 18</strong> studied words were recalled.`;

    let html = `<table><thead><tr><th>Encoding strategy</th><th>Recalled</th><th>Score</th></tr></thead><tbody>`;
    strategies.forEach(s => {
      const c = counts[s.key];
      html += `<tr><td>${c.label}</td><td>${c.recalled} / ${c.total}</td><td>${Math.round(c.recalled / c.total * 100)}%</td></tr>`;
    });
    html += `</tbody></table>`;
    $("resultTable").innerHTML = html;
  }

  function makeSummaryCsv() {
    const counts = {};
    strategies.forEach(s => counts[s.key] = 0);
    state.results.forEach(t => { if (t.recalled) counts[t.strategy]++; });

    const headers = [
      "participant_id","session_id","started_at","ended_at",
      "maintenance_rehearsal_recalled","self_reference_recalled","mental_imagery_recalled",
      "total_recalled","distractor_start_number","distractor_response"
    ];
    const row = [
      state.participantId, state.sessionId, state.startedAt, state.endedAt,
      counts.maintenance_rehearsal, counts.self_reference, counts.mental_imagery,
      state.results.filter(t => t.recalled).length,
      state.startingNumber, state.distractorResponse
    ];
    return headers.map(escapeCsv).join(",") + "\n" + row.map(escapeCsv).join(",") + "\n";
  }

  function makeTrialCsv() {
    const headers = [
      "participant_id","session_id","block","strategy","strategy_label",
      "word_position","word","recalled","matched_response"
    ];
    const lines = [headers.map(escapeCsv).join(",")];
    for (const t of state.results) {
      lines.push([
        state.participantId, state.sessionId, t.block, t.strategy, t.strategyLabel,
        t.wordPosition, t.word, t.recalled, t.matchedResponse
      ].map(escapeCsv).join(","));
    }
    return lines.join("\n") + "\n";
  }

  $("startBtn").addEventListener("click", startExperiment);
  $("continueBtn").addEventListener("click", startBlock);
  $("scoreBtn").addEventListener("click", scoreExperiment);
  $("downloadSummary").addEventListener("click", () => {
    download(`encoding_summary_${state.sessionId}.csv`, makeSummaryCsv());
  });
  $("downloadTrials").addEventListener("click", () => {
    download(`encoding_trials_${state.sessionId}.csv`, makeTrialCsv());
  });
  $("restartBtn").addEventListener("click", () => location.reload());

  $("distractorInput").addEventListener("keydown", e => {
    // Prevent accidental form-like submission behavior.
    if (e.key === "Enter") e.preventDefault();
  });
})();
