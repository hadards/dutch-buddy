import "./style.css";
import { getPassphrase, setPassphrase, checkPassphrase, translateText, translateImage, translateVoice, getContacts, getAreas } from "./api.js";

const app = document.getElementById("app")!;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function todayPostmark(): string {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase() + " • NL";
}

async function boot() {
  if (!getPassphrase() || !(await checkPassphrase())) {
    renderGate();
  } else {
    renderApp();
  }
}

function renderGate() {
  app.innerHTML = `
    <div class="gate">
      <h1>Dutch Buddy</h1>
      <p>Enter the family passphrase to continue.</p>
      <input type="text" id="pass" autocomplete="off" />
      <button class="primary" id="enter">Enter</button>
      <p class="status error" id="gate-error"></p>
    </div>
  `;
  const input = document.getElementById("pass") as HTMLInputElement;
  const errorEl = document.getElementById("gate-error")!;
  document.getElementById("enter")!.addEventListener("click", async () => {
    setPassphrase(input.value);
    if (await checkPassphrase()) {
      renderApp();
    } else {
      errorEl.textContent = "Wrong passphrase, try again.";
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("enter")!.click();
  });
}

type Page = "text" | "photo" | "voice" | "numbers" | "areas";

function renderApp() {
  app.innerHTML = `
    <header class="top">
      <h1>Dutch Buddy</h1>
      <span class="postmark">${todayPostmark()}</span>
    </header>
    <main>
      <section class="page" data-page="text">
        <h2>Translate text</h2>
        <textarea id="text-input" rows="4" placeholder="Type in English, Hebrew, or Dutch..."></textarea>
        <button class="primary" id="text-go">Translate</button>
        <p class="status" id="text-status"></p>
        <div class="result" id="text-result" hidden></div>
      </section>

      <section class="page" data-page="photo">
        <h2>Translate a photo</h2>
        <p>Take a photo of a sign, letter, or menu.</p>
        <input type="file" id="photo-input" accept="image/*" capture="environment" />
        <p class="status" id="photo-status"></p>
        <div class="result" id="photo-result" hidden></div>
      </section>

      <section class="page" data-page="voice">
        <h2>Translate voice</h2>
        <p>Record a voice note to translate.</p>
        <button class="primary" id="voice-record">Start recording</button>
        <p class="status" id="voice-status"></p>
        <div class="result" id="voice-result" hidden></div>
      </section>

      <section class="page" data-page="numbers">
        <h2>Phone numbers</h2>
        <div id="numbers-list">Loading…</div>
      </section>

      <section class="page" data-page="areas">
        <h2>Areas</h2>
        <div id="areas-list">Loading…</div>
      </section>
    </main>
    <nav class="tabs">
      <button data-page="text" class="active">Text</button>
      <button data-page="photo">Photo</button>
      <button data-page="voice">Voice</button>
      <button data-page="numbers">Numbers</button>
      <button data-page="areas">Areas</button>
    </nav>
  `;

  const pages = document.querySelectorAll<HTMLElement>("main .page");
  const tabs = document.querySelectorAll<HTMLButtonElement>("nav.tabs button");

  function showPage(name: Page) {
    pages.forEach((p) => p.classList.toggle("active", p.dataset.page === name));
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.page === name));
  }
  tabs.forEach((t) => t.addEventListener("click", () => showPage(t.dataset.page as Page)));
  showPage("text");

  setupTextPage();
  setupPhotoPage();
  setupVoicePage();
  setupNumbersPage();
  setupAreasPage();
}

function showResult(el: HTMLElement, text: string) {
  el.hidden = false;
  el.textContent = text;
  el.setAttribute("dir", /[֐-׿]/.test(text) ? "rtl" : "ltr");
}

function setupTextPage() {
  const input = document.getElementById("text-input") as HTMLTextAreaElement;
  const status = document.getElementById("text-status")!;
  const result = document.getElementById("text-result")!;
  const go = document.getElementById("text-go") as HTMLButtonElement;

  go.addEventListener("click", async () => {
    if (!input.value.trim()) return;
    go.disabled = true;
    status.textContent = "Translating…";
    status.classList.remove("error");
    try {
      showResult(result, await translateText(input.value));
      status.textContent = "";
    } catch (e) {
      status.textContent = (e as Error).message;
      status.classList.add("error");
    } finally {
      go.disabled = false;
    }
  });
}

function setupPhotoPage() {
  const input = document.getElementById("photo-input") as HTMLInputElement;
  const status = document.getElementById("photo-status")!;
  const result = document.getElementById("photo-result")!;

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    status.textContent = "Translating…";
    status.classList.remove("error");
    try {
      const base64 = await fileToBase64(file);
      showResult(result, await translateImage(base64, file.type || "image/jpeg"));
      status.textContent = "";
    } catch (e) {
      status.textContent = (e as Error).message;
      status.classList.add("error");
    }
  });
}

function setupVoicePage() {
  const button = document.getElementById("voice-record") as HTMLButtonElement;
  const status = document.getElementById("voice-status")!;
  const result = document.getElementById("voice-result")!;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  button.addEventListener("click", async () => {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        button.textContent = "Start recording";
        status.textContent = "Translating…";
        status.classList.remove("error");
        try {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const base64 = await fileToBase64(new File([blob], "voice.webm"));
          showResult(result, await translateVoice(base64, "audio/webm"));
          status.textContent = "";
        } catch (e) {
          status.textContent = (e as Error).message;
          status.classList.add("error");
        }
      };
      recorder.start();
      button.textContent = "Stop recording";
      status.textContent = "Recording…";
    } catch {
      status.textContent = "Microphone access denied.";
      status.classList.add("error");
    }
  });
}

async function setupNumbersPage() {
  const list = document.getElementById("numbers-list")!;
  try {
    const contacts = await getContacts();
    list.innerHTML = contacts
      .map(
        (c) => `
      <div class="contact-item">
        <div class="name">${escapeHtml(c.name)}</div>
        ${c.number ? `<div class="number">${escapeHtml(c.number)}</div>` : ""}
        ${c.notes ? `<div class="notes">${escapeHtml(c.notes)}</div>` : ""}
      </div>`
      )
      .join("");
  } catch (e) {
    list.textContent = (e as Error).message;
  }
}

async function setupAreasPage() {
  const list = document.getElementById("areas-list")!;
  try {
    const areas = await getAreas();
    list.innerHTML = areas
      .map(
        (a) => `
      <div class="area-item">
        <div class="name">${escapeHtml(a.name)}</div>
        <div class="notes">${escapeHtml(a.notes)}</div>
      </div>`
      )
      .join("");
  } catch (e) {
    list.textContent = (e as Error).message;
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

boot();
