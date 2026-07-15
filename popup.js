async function getDeck() {
  const { deck } = await chrome.storage.local.get("deck");
  return deck || [];
}

async function setDeck(deck) {
  await chrome.storage.local.set({ deck });
}

async function refreshStats() {
  const { stats } = await chrome.storage.local.get("stats");
  const s = stats || { reviews: 0, correct: 0 };
  document.getElementById("abf-reviews").textContent = s.reviews;
  document.getElementById("abf-accuracy").textContent =
    s.reviews > 0 ? Math.round((s.correct / s.reviews) * 100) + "%" : "—";
}

function boxLabel(box) {
  return box === 3 ? "learned" : box === 2 ? "review" : "new";
}

async function refreshList() {
  const deck = await getDeck();
  document.getElementById("abf-count").textContent = deck.length;
  const list = document.getElementById("abf-list");
  list.innerHTML = "";
  deck
    .slice()
    .reverse()
    .forEach((card) => {
      const row = document.createElement("div");
      row.className = "abf-item";
      row.innerHTML = `
        <span>${escapeHtml(card.front)}</span>
        <span class="box">${boxLabel(card.box)}
          <button class="abf-remove" data-id="${card.id}" title="Remove">×</button>
        </span>
      `;
      list.appendChild(row);
    });

  list.querySelectorAll(".abf-remove").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      const deck = (await getDeck()).filter((c) => c.id !== id);
      await setDeck(deck);
      refreshList();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function makeId() {
  return "c" + Math.random().toString(36).slice(2, 10);
}

document.getElementById("abf-add-btn").addEventListener("click", async () => {
  const front = document.getElementById("abf-front-input").value.trim();
  const back = document.getElementById("abf-back-input").value.trim();
  if (!front || !back) return;
  const deck = await getDeck();
  deck.push({ id: makeId(), front, back, box: 1, lastSeen: 0 });
  await setDeck(deck);
  document.getElementById("abf-front-input").value = "";
  document.getElementById("abf-back-input").value = "";
  refreshList();
});

document.getElementById("abf-import-btn").addEventListener("click", async () => {
  const raw = document.getElementById("abf-import").value;
  if (!raw.trim()) return;
  const deck = await getDeck();
  let added = 0;
  raw.split("\n").forEach((line) => {
    if (!line.trim()) return;
    const parsed = parseLine(line);
    if (parsed) {
      deck.push({ id: makeId(), front: parsed.front, back: parsed.back, box: 1, lastSeen: 0 });
      added++;
    }
  });
  await setDeck(deck);
  document.getElementById("abf-import").value = "";
  refreshList();
  if (added === 0) {
    alert("Couldn't find any term/definition pairs. Make sure each line has a tab, comma, or dash between the two.");
  }
});

// Handles Quizlet's plain-text export format (tab-separated by default),
// as well as comma- or dash-separated pastes, and strips wrapping quotes.
function parseLine(line) {
  let front, back;
  if (line.includes("\t")) {
    const parts = line.split("\t");
    front = parts[0];
    back = parts.slice(1).join(" ");
  } else if (line.includes(" - ")) {
    const idx = line.indexOf(" - ");
    front = line.slice(0, idx);
    back = line.slice(idx + 3);
  } else if (line.includes(",")) {
    const idx = line.indexOf(",");
    front = line.slice(0, idx);
    back = line.slice(idx + 1);
  } else {
    return null;
  }
  front = stripQuotes(front.trim());
  back = stripQuotes(back.trim());
  if (!front || !back) return null;
  return { front, back };
}

function stripQuotes(str) {
  if (str.length >= 2 && str.startsWith('"') && str.endsWith('"')) {
    return str.slice(1, -1).trim();
  }
  return str;
}

document.getElementById("abf-test-btn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes("youtube.com/watch")) {
    alert("Open a YouTube video tab first, then click this again.");
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "abf-simulate-ad" }, () => {
    if (chrome.runtime.lastError) {
      alert("Couldn't reach the page — try reloading the YouTube tab first.");
    }
  });
});

refreshStats();
refreshList();
