let port, writer, reader;

// Tournament State
let currentRound = 1;
const TOTAL_ROUNDS = 3;
let p1Scores = [null, null, null];
let p2Scores = [null, null, null];
let p1Wins = 0;
let p2Wins = 0;

let currentP1Time = null;
let currentP2Time = null;
let roundInProgress = false;

async function connectSerial() {
  if (!("serial" in navigator)) {
    alert("Web Serial is not supported. Please use Google Chrome or Microsoft Edge.");
    return;
  }

  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    writer = port.writable.getWriter();

    document.getElementById('btnConnect').innerText = "✅ Connected";
    document.getElementById('btnConnect').disabled = true;
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnReset').disabled = false;
    document.getElementById('connStatus').innerText = "Connected to Arduino (COM Port active)";
    document.getElementById('connStatus').style.color = "#00e676";

    readSerialStream();
  } catch (err) {
    console.error(err);
    alert("Could not connect: " + err.message);
  }
}

async function sendCommand(cmd) {
  if (writer) {
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(cmd));
  }
}

async function readSerialStream() {
  const textDecoder = new TextDecoderStream();
  port.readable.pipeTo(textDecoder.writable);
  reader = textDecoder.readable.getReader();

  let lineBuffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      lineBuffer += value;
      let lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop();

      for (let rawLine of lines) {
        let line = rawLine.trim();
        if (line.length > 0) {
          handleIncomingMessage(line);
        }
      }
    }
  } catch (err) {
    console.error("Read error:", err);
  }
}

function setAllLamps(colorClass) {
  const lamps = ['p1_l1', 'p1_l2', 'p1_l3', 'p2_l1', 'p2_l2', 'p2_l3'];
  lamps.forEach(id => {
    document.getElementById(id).className = 'lamp ' + colorClass;
  });
}

function handleStartClick() {
  if (currentRound > TOTAL_ROUNDS) {
    resetTournament();
    return;
  }
  roundInProgress = true;
  document.getElementById('btnStart').disabled = true;
  sendCommand('S');
}

function resetTournament() {
  currentRound = 1;
  p1Scores = [null, null, null];
  p2Scores = [null, null, null];
  p1Wins = 0;
  p2Wins = 0;
  currentP1Time = null;
  currentP2Time = null;
  roundInProgress = false;

  // Clear UI elements
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`p1_r${i}`).innerText = "--";
    document.getElementById(`p2_r${i}`).innerText = "--";
  }
  document.getElementById('p1_wins').innerText = "0";
  document.getElementById('p2_wins').innerText = "0";
  document.getElementById('p1_time').innerText = "-- ms";
  document.getElementById('p2_time').innerText = "-- ms";
  document.getElementById('winnerBanner').innerText = "";
  document.getElementById('roundIndicator').innerText = "ROUND 1 OF 3";
  document.getElementById('btnStart').innerText = "▶️ START ROUND 1";
  document.getElementById('btnStart').disabled = false;

  sendCommand('R');
}

function handleIncomingMessage(msg) {
  if (msg.includes("STATUS:IDLE") || msg.includes("LIGHTS:BLUE")) {
    setAllLamps('blue-on');
    if (!roundInProgress) {
      document.getElementById('p1_status').innerText = "Ready";
      document.getElementById('p2_status').innerText = "Ready";
    }
  } 
  else if (msg.includes("STATUS:STARTING")) {
    setAllLamps('');
    currentP1Time = null; 
    currentP2Time = null;
    document.getElementById('p1_time').innerText = "-- ms";
    document.getElementById('p2_time').innerText = "-- ms";
    document.getElementById('p1_status').innerText = "Watch lights...";
    document.getElementById('p2_status').innerText = "Watch lights...";
  }
  else if (msg.includes("LIGHTS:RED1")) {
    document.getElementById('p1_l1').className = 'lamp red-on';
    document.getElementById('p2_l1').className = 'lamp red-on';
  }
  else if (msg.includes("LIGHTS:RED2")) {
    document.getElementById('p1_l2').className = 'lamp red-on';
    document.getElementById('p2_l2').className = 'lamp red-on';
  }
  else if (msg.includes("LIGHTS:RED3")) {
    document.getElementById('p1_l3').className = 'lamp red-on';
    document.getElementById('p2_l3').className = 'lamp red-on';
  }
  else if (msg.includes("LIGHTS:GREEN")) {
    setAllLamps('green-on');
    document.getElementById('p1_status').innerText = "🟢 REACT NOW!";
    document.getElementById('p2_status').innerText = "🟢 REACT NOW!";
  }
  else if (msg.includes("EVENT:P1_JUMP")) {
    currentP1Time = -1;
    document.getElementById('p1_time').innerText = "FALSE START";
    document.getElementById('p1_status').innerText = "❌ Disqualified";
  }
  else if (msg.includes("EVENT:P2_JUMP")) {
    currentP2Time = -1;
    document.getElementById('p2_time').innerText = "FALSE START";
    document.getElementById('p2_status').innerText = "❌ Disqualified";
  }
  else if (msg.includes("RESULT:P1:")) {
    currentP1Time = parseInt(msg.split("RESULT:P1:")[1]);
    document.getElementById('p1_time').innerText = currentP1Time + " ms";
    document.getElementById('p1_status').innerText = "Finished";
    evaluateRoundOutcome();
  }
  else if (msg.includes("RESULT:P2:")) {
    currentP2Time = parseInt(msg.split("RESULT:P2:")[1]);
    document.getElementById('p2_time').innerText = currentP2Time + " ms";
    document.getElementById('p2_status').innerText = "Finished";
    evaluateRoundOutcome();
  }
}

function evaluateRoundOutcome() {
  if (currentP1Time !== null && currentP2Time !== null && roundInProgress) {
    roundInProgress = false;

    // Save to match history array
    p1Scores[currentRound - 1] = currentP1Time;
    p2Scores[currentRound - 1] = currentP2Time;

    // Update scoreboard history display
    document.getElementById(`p1_r${currentRound}`).innerText = currentP1Time < 0 ? "FAULT" : `${currentP1Time} ms`;
    document.getElementById(`p2_r${currentRound}`).innerText = currentP2Time < 0 ? "FAULT" : `${currentP2Time} ms`;

    // Award round winner
    if (currentP1Time > 0 && (currentP2Time < 0 || currentP1Time < currentP2Time)) {
      p1Wins++;
    } else if (currentP2Time > 0 && (currentP1Time < 0 || currentP2Time < currentP1Time)) {
      p2Wins++;
    }

    document.getElementById('p1_wins').innerText = p1Wins;
    document.getElementById('p2_wins').innerText = p2Wins;

    // Advance Round or Finish Match
    if (currentRound < TOTAL_ROUNDS) {
      currentRound++;
      document.getElementById('roundIndicator').innerText = `ROUND ${currentRound} OF 3`;
      document.getElementById('btnStart').innerText = `▶️ START ROUND ${currentRound}`;
      document.getElementById('btnStart').disabled = false;
    } else {
      declareFinalChampion();
    }
  }
}

function declareFinalChampion() {
  const banner = document.getElementById('winnerBanner');
  document.getElementById('roundIndicator').innerText = "🏆 MATCH FINISHED";
  document.getElementById('btnStart').innerText = "🔄 PLAY NEW MATCH";
  document.getElementById('btnStart').disabled = false;

  if (p1Wins > p2Wins) {
    banner.innerText = `👑 PLAYER 1 WINS THE MATCH (${p1Wins} - ${p2Wins})!`;
  } else if (p2Wins > p1Wins) {
    banner.innerText = `👑 PLAYER 2 WINS THE MATCH (${p2Wins} - ${p1Wins})!`;
  } else {
    // Tiebreaker: compute valid average times
    let p1Valid = p1Scores.filter(s => s > 0);
    let p2Valid = p2Scores.filter(s => s > 0);
    let p1Avg = p1Valid.length ? p1Valid.reduce((a, b) => a + b) / p1Valid.length : 9999;
    let p2Avg = p2Valid.length ? p2Valid.reduce((a, b) => a + b) / p2Valid.length : 9999;

    if (p1Avg < p2Avg) {
      banner.innerText = `👑 PLAYER 1 WINS ON TIME TIEBREAKER!`;
    } else if (p2Avg < p1Avg) {
      banner.innerText = `👑 PLAYER 2 WINS ON TIME TIEBREAKER!`;
    } else {
      banner.innerText = "🤝 IT'S AN OVERALL MATCH TIE!";
    }
  }
}let port, writer, reader;

// Tournament State
let currentRound = 1;
const TOTAL_ROUNDS = 3;
let p1Scores = [null, null, null];
let p2Scores = [null, null, null];
let p1Wins = 0;
let p2Wins = 0;

let currentP1Time = null;
let currentP2Time = null;
let roundInProgress = false;

async function connectSerial() {
  if (!("serial" in navigator)) {
    alert("Web Serial is not supported. Please use Google Chrome or Microsoft Edge.");
    return;
  }

  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    writer = port.writable.getWriter();

    document.getElementById('btnConnect').innerText = "✅ Connected";
    document.getElementById('btnConnect').disabled = true;
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnReset').disabled = false;
    document.getElementById('connStatus').innerText = "Connected to Arduino (COM Port active)";
    document.getElementById('connStatus').style.color = "#00e676";

    readSerialStream();
  } catch (err) {
    console.error(err);
    alert("Could not connect: " + err.message);
  }
}

async function sendCommand(cmd) {
  if (writer) {
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(cmd));
  }
}

async function readSerialStream() {
  const textDecoder = new TextDecoderStream();
  port.readable.pipeTo(textDecoder.writable);
  reader = textDecoder.readable.getReader();

  let lineBuffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      lineBuffer += value;
      let lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop();

      for (let rawLine of lines) {
        let line = rawLine.trim();
        if (line.length > 0) {
          handleIncomingMessage(line);
        }
      }
    }
  } catch (err) {
    console.error("Read error:", err);
  }
}

function setAllLamps(colorClass) {
  const lamps = ['p1_l1', 'p1_l2', 'p1_l3', 'p2_l1', 'p2_l2', 'p2_l3'];
  lamps.forEach(id => {
    document.getElementById(id).className = 'lamp ' + colorClass;
  });
}

function handleStartClick() {
  if (currentRound > TOTAL_ROUNDS) {
    resetTournament();
    return;
  }
  roundInProgress = true;
  document.getElementById('btnStart').disabled = true;
  sendCommand('S');
}

function resetTournament() {
  currentRound = 1;
  p1Scores = [null, null, null];
  p2Scores = [null, null, null];
  p1Wins = 0;
  p2Wins = 0;
  currentP1Time = null;
  currentP2Time = null;
  roundInProgress = false;

  // Clear UI elements
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`p1_r${i}`).innerText = "--";
    document.getElementById(`p2_r${i}`).innerText = "--";
  }
  document.getElementById('p1_wins').innerText = "0";
  document.getElementById('p2_wins').innerText = "0";
  document.getElementById('p1_time').innerText = "-- ms";
  document.getElementById('p2_time').innerText = "-- ms";
  document.getElementById('winnerBanner').innerText = "";
  document.getElementById('roundIndicator').innerText = "ROUND 1 OF 3";
  document.getElementById('btnStart').innerText = "▶️ START ROUND 1";
  document.getElementById('btnStart').disabled = false;

  sendCommand('R');
}

function handleIncomingMessage(msg) {
  if (msg.includes("STATUS:IDLE") || msg.includes("LIGHTS:BLUE")) {
    setAllLamps('blue-on');
    if (!roundInProgress) {
      document.getElementById('p1_status').innerText = "Ready";
      document.getElementById('p2_status').innerText = "Ready";
    }
  } 
  else if (msg.includes("STATUS:STARTING")) {
    setAllLamps('');
    currentP1Time = null; 
    currentP2Time = null;
    document.getElementById('p1_time').innerText = "-- ms";
    document.getElementById('p2_time').innerText = "-- ms";
    document.getElementById('p1_status').innerText = "Watch lights...";
    document.getElementById('p2_status').innerText = "Watch lights...";
  }
  else if (msg.includes("LIGHTS:RED1")) {
    document.getElementById('p1_l1').className = 'lamp red-on';
    document.getElementById('p2_l1').className = 'lamp red-on';
  }
  else if (msg.includes("LIGHTS:RED2")) {
    document.getElementById('p1_l2').className = 'lamp red-on';
    document.getElementById('p2_l2').className = 'lamp red-on';
  }
  else if (msg.includes("LIGHTS:RED3")) {
    document.getElementById('p1_l3').className = 'lamp red-on';
    document.getElementById('p2_l3').className = 'lamp red-on';
  }
  else if (msg.includes("LIGHTS:GREEN")) {
    setAllLamps('green-on');
    document.getElementById('p1_status').innerText = "🟢 REACT NOW!";
    document.getElementById('p2_status').innerText = "🟢 REACT NOW!";
  }
  else if (msg.includes("EVENT:P1_JUMP")) {
    currentP1Time = -1;
    document.getElementById('p1_time').innerText = "FALSE START";
    document.getElementById('p1_status').innerText = "❌ Disqualified";
  }
  else if (msg.includes("EVENT:P2_JUMP")) {
    currentP2Time = -1;
    document.getElementById('p2_time').innerText = "FALSE START";
    document.getElementById('p2_status').innerText = "❌ Disqualified";
  }
  else if (msg.includes("RESULT:P1:")) {
    currentP1Time = parseInt(msg.split("RESULT:P1:")[1]);
    document.getElementById('p1_time').innerText = currentP1Time + " ms";
    document.getElementById('p1_status').innerText = "Finished";
    evaluateRoundOutcome();
  }
  else if (msg.includes("RESULT:P2:")) {
    currentP2Time = parseInt(msg.split("RESULT:P2:")[1]);
    document.getElementById('p2_time').innerText = currentP2Time + " ms";
    document.getElementById('p2_status').innerText = "Finished";
    evaluateRoundOutcome();
  }
}

function evaluateRoundOutcome() {
  if (currentP1Time !== null && currentP2Time !== null && roundInProgress) {
    roundInProgress = false;

    // Save to match history array
    p1Scores[currentRound - 1] = currentP1Time;
    p2Scores[currentRound - 1] = currentP2Time;

    // Update scoreboard history display
    document.getElementById(`p1_r${currentRound}`).innerText = currentP1Time < 0 ? "FAULT" : `${currentP1Time} ms`;
    document.getElementById(`p2_r${currentRound}`).innerText = currentP2Time < 0 ? "FAULT" : `${currentP2Time} ms`;

    // Award round winner
    if (currentP1Time > 0 && (currentP2Time < 0 || currentP1Time < currentP2Time)) {
      p1Wins++;
    } else if (currentP2Time > 0 && (currentP1Time < 0 || currentP2Time < currentP1Time)) {
      p2Wins++;
    }

    document.getElementById('p1_wins').innerText = p1Wins;
    document.getElementById('p2_wins').innerText = p2Wins;

    // Advance Round or Finish Match
    if (currentRound < TOTAL_ROUNDS) {
      currentRound++;
      document.getElementById('roundIndicator').innerText = `ROUND ${currentRound} OF 3`;
      document.getElementById('btnStart').innerText = `▶️ START ROUND ${currentRound}`;
      document.getElementById('btnStart').disabled = false;
    } else {
      declareFinalChampion();
    }
  }
}

function declareFinalChampion() {
  const banner = document.getElementById('winnerBanner');
  document.getElementById('roundIndicator').innerText = "🏆 MATCH FINISHED";
  document.getElementById('btnStart').innerText = "🔄 PLAY NEW MATCH";
  document.getElementById('btnStart').disabled = false;

  if (p1Wins > p2Wins) {
    banner.innerText = `👑 PLAYER 1 WINS THE MATCH (${p1Wins} - ${p2Wins})!`;
  } else if (p2Wins > p1Wins) {
    banner.innerText = `👑 PLAYER 2 WINS THE MATCH (${p2Wins} - ${p1Wins})!`;
  } else {
    // Tiebreaker: compute valid average times
    let p1Valid = p1Scores.filter(s => s > 0);
    let p2Valid = p2Scores.filter(s => s > 0);
    let p1Avg = p1Valid.length ? p1Valid.reduce((a, b) => a + b) / p1Valid.length : 9999;
    let p2Avg = p2Valid.length ? p2Valid.reduce((a, b) => a + b) / p2Valid.length : 9999;

    if (p1Avg < p2Avg) {
      banner.innerText = `👑 PLAYER 1 WINS ON TIME TIEBREAKER!`;
    } else if (p2Avg < p1Avg) {
      banner.innerText = `👑 PLAYER 2 WINS ON TIME TIEBREAKER!`;
    } else {
      banner.innerText = "🤝 IT'S AN OVERALL MATCH TIE!";
    }
  }
}