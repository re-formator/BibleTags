$('#modal-1').on('shown.bs.modal', function() {$('#input1').focus();});

let bible;
let highlights = loadHighlights();

const tags = [
  { id: 1, color: "amber", text: "Вера" },
  { id: 2, color: "aqua", text: "Любовь" },
  { id: 3, color: "yellow", text: "Надежда" },
  { id: 4, color: "light-green", text: "Мудрость" }
];

async function loadBible() {
  try {
    const response = await fetch('assets/js/bible-rst.json');
    if (!response.ok) {
      throw new Error('HTTP error ' + response.status);
    }
    bible = await response.json();
    console.log("Книга загружена:", bible);
    return bible;
  } catch (error) {
    console.error('Ошибка загрузки:', error);
  }
}
loadBible().then(bible => {
  renderBooks("oldTestament", 0, 39);
  renderBooks("newTestament", 39, 66);
  renderBibleText();
  renderTags();
  highlightByTag(null);
});
  

function getChapter(book = 1, chapter=1){
  
  return 
}

function loadHighlights() {
  try {
    const saved = localStorage.getItem('BibleTagHighlights');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch(e) {
    console.error("Ошибка загрузки highlights:", e);
  }
  return [];
}
function saveHighlights(highlights) {
  try {
    localStorage.setItem('BibleTagHighlights', JSON.stringify(highlights));
  } catch(e) {
    console.error("Ошибка сохранения highlights:", e);
  }
}

const nav = document.getElementById("tag-nav");

function clearHighlights() {
  // снимаем все <mark>
  document.querySelectorAll("#bible-text span").forEach(span => {
    span.innerHTML = span.textContent; // вернуть чистый текст
  });
}



/* утилита — экранирует текст перед вставкой в innerHTML */
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clearHighlights() {
  document.querySelectorAll("#bible-text [data-verse] span").forEach(span => {
    // возвращаем чистый текст (без <mark>)
    span.innerHTML = escapeHtml(span.textContent || "");
  });
}

function highlightByTag(selectedTag) {
  clearHighlights();

  const tagMap = tags.reduce((m, t) => { m[t.id] = t; return m; }, {});

  // либо только для выбранного тега, либо для всех
  const tagHighlights = selectedTag
    ? highlights.filter(h => h.tagId === selectedTag.id)
    : highlights.slice();

  // группируем по стихам
  const highlightsByVerse = {};
  tagHighlights.forEach(h => {
    const key = `${h.book}|${h.chapter}|${h.verse}`;
    if (!highlightsByVerse[key]) highlightsByVerse[key] = [];
    highlightsByVerse[key].push(h);
  });

  Object.entries(highlightsByVerse).forEach(([key, verseHighlights]) => {
    const [book, chapter, verse] = key.split("|");
    const verseEl = document.querySelector(
      `[data-book="${book}"][data-chapter="${chapter}"][data-verse="${verse}"] span`
    );
    if (!verseEl) return;

    const text = verseEl.textContent || "";
    if (!text) return;

    // собираем маркеры
    const markers = [];
    verseHighlights.forEach(h => {
      const tag = tagMap[h.tagId];
      const cls = tag ? tag.color : (`tag-${h.tagId}`); // fallback class
      let start = Math.max(0, Math.min(Math.floor(h.start), text.length));
      let end   = Math.max(0, Math.min(Math.floor(h.end),   text.length));
      if (end <= start) return; // игнорируем некорректные
      markers.push({ pos: start, type: 'start', cls, tagId: h.tagId });
      markers.push({ pos: end,   type: 'end',   cls, tagId: h.tagId });
    });

    if (markers.length === 0) {
      verseEl.innerHTML = escapeHtml(text);
      return;
    }

    // сортируем: по позиции, при равной позиции сначала end, затем start
    const typeOrder = { end: 0, start: 1 };
    markers.sort((a, b) => {
      if (a.pos !== b.pos) return a.pos - b.pos;
      if (a.type === b.type) return 0;
      return typeOrder[a.type] - typeOrder[b.type];
    });

    // строим HTML частями
    let resultHTML = "";
    let lastPos = 0;
    const active = []; // массив активных классов (удобнее чем Set для order/debug)

    for (const m of markers) {
      const pos = m.pos;
      if (pos > lastPos) {
        const chunk = text.slice(lastPos, pos);
        if (active.length === 0) {
          resultHTML += escapeHtml(chunk);
        } else if (active.length === 1) {
          resultHTML += `<mark class="${active[0]}">${escapeHtml(chunk)}</mark>`;
        } else {
          // несколько классов — даём специальный класс multi + сохраняем список в data
          const joined = active.join(' ');
          resultHTML += `<mark class="multi ${joined}" data-tags="${escapeHtml(joined)}">${escapeHtml(chunk)}</mark>`;
        }
      }

      // обновляем active: при start — push (если ещё нет), при end — remove 1-ю встречу
      if (m.type === 'start') {
        if (!active.includes(m.cls)) active.push(m.cls);
      } else { // end
        const idx = active.indexOf(m.cls);
        if (idx !== -1) active.splice(idx, 1);
      }
      lastPos = pos;
    }

    // остаток текста
    if (lastPos < text.length) {
      const chunk = text.slice(lastPos);
      if (active.length === 0) {
        resultHTML += escapeHtml(chunk);
      } else if (active.length === 1) {
        resultHTML += `<mark class="${active[0]}">${escapeHtml(chunk)}</mark>`;
      } else {
        const joined = active.join(' ');
        resultHTML += `<mark class="multi ${joined}" data-tags="${escapeHtml(joined)}">${escapeHtml(chunk)}</mark>`;
      }
    }
    verseEl.innerHTML = resultHTML;
  });
}

function renderBibleText(bookName = 'Быт.', chapterNumber = 1) {
  document.querySelectorAll('.testament-panel').forEach(p => p.classList.remove('open'));
  const container = document.getElementById("bible-text");
  container.innerHTML = "";

  // Находим книгу по имени
  const bookObj = bible.Books.find(b => b.BookName === bookName);
  if (!bookObj) {
    container.textContent = `Книга "${bookName}" не найдена`;
    return;
  }

  // Номер главы — в массиве с 0, поэтому вычитаем 1
  const chapterIndex = chapterNumber - 1;
  const chapterObj = bookObj.Chapters[chapterIndex];
  if (!chapterObj) {
    container.textContent = `Глава ${chapterNumber} не найдена в книге "${bookName}"`;
    return;
  }

  const verses = chapterObj.Verses;

  verses.forEach(verseObj => {
    const { VerseId, Text } = verseObj;

    const div = document.createElement("div");
    div.setAttribute("data-book", bookObj.BookId);
    div.setAttribute("data-chapter", chapterObj.ChapterId);
    div.setAttribute("data-verse", VerseId);

    const b = document.createElement("b");
    b.textContent = VerseId + ". ";

    const span = document.createElement("span");
    span.textContent = Text;

    div.appendChild(b);
    div.appendChild(span);
    container.appendChild(div);
  });

  // Обновляем заголовок
  document.getElementById("bookChapterHeader").textContent =
    bookObj.BookName + " " + chapterObj.ChapterId;

  // Обновляем URL без перезагрузки страницы
  history.pushState(null, "", `/?${encodeURIComponent(bookName)}:${chapterNumber}`);
}



    
function renderTags() {
  const container = document.getElementById("tag-buttons");
  container.innerHTML = "";
  nav.innerHTML = '<li class="nav-item" onClick="highlightByTag()"><div class="nav-link active d-flex align-items-center" style="cursor: pointer;"><span>Все</span></div></li>';
  tags.forEach(tag => {
// context menu
    const btn = document.createElement("button");
    btn.className = "btn btn-sm text-white " + tag.color;
    btn.textContent = tag.text;
    btn.dataset.tagId = tag.id;
btn.addEventListener("click", () => {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const range = sel.getRangeAt(0);
  const startNode = range.startContainer;
  const endNode   = range.endContainer;

  const startVerse = startNode.parentElement.closest("[data-book][data-chapter][data-verse]");
  const endVerse   = endNode.parentElement.closest("[data-book][data-chapter][data-verse]");

  if (!startVerse || !endVerse) {
    alert("Выделение вне текста");
    return;
  }

  // Все стихи в диапазоне
  const verses = [];
  let collect = false;
  document.querySelectorAll("#bible-text [data-verse]").forEach(div => {
    if (div === startVerse) collect = true;
    if (collect) verses.push(div);
    if (div === endVerse) collect = false;
  });

  verses.forEach(div => {
    const span = div.querySelector("span");
    if (!span) return;

    const text = span.textContent;
    let start = 0, end = text.length;

    if (div === startVerse) {
      const tmp = document.createRange();
      tmp.selectNodeContents(span);
      tmp.setEnd(range.startContainer, range.startOffset);
      start = tmp.toString().length;
    }

    if (div === endVerse) {
      const tmp = document.createRange();
      tmp.selectNodeContents(span);
      tmp.setEnd(range.endContainer, range.endOffset);
      end = tmp.toString().length;
    }

    if (end > start) {
      highlights.push({
        tagId: tag.id,
        book: div.dataset.book,
        chapter: parseInt(div.dataset.chapter, 10),
        verse: parseInt(div.dataset.verse, 10),
        start,
        end
      });
      saveHighlights(highlights);
    }
  });

  // обновляем подсветку
  highlightByTag(null);
  document.getElementById("context-menu").style.display = "none";

  console.log("Добавлено выделений:", highlights.slice(-verses.length));
});

    container.appendChild(btn);
// tags bar
    const li = document.createElement("li");
    li.className = "nav-item";
    const div = document.createElement("div");
    div.className = "nav-link d-flex align-items-center";
    div.style.cursor = "pointer";
    const colorBox = document.createElement("div");
    colorBox.className = "color-box me-2 " + tag.color;
    colorBox.style.width = "14px";
    colorBox.style.height = "14px";
    colorBox.style.borderRadius = "3px";
    const span = document.createElement("span");
    span.textContent = tag.text;
    div.appendChild(colorBox);
    div.appendChild(span);
    div.addEventListener("click", () => {
      nav.querySelectorAll(".nav-link").forEach(el => el.classList.remove("active"));
      div.classList.add("active");
      highlightByTag(tag);
    });
    li.appendChild(div);
    nav.appendChild(li);
  });
    const li = document.createElement("li");
    li.className = "nav-item";
    li.innerHTML = `<a class="nav-link" href="#" data-bs-target="#modal-1" data-bs-toggle="modal"><i class="far fa-plus-square"></i></a>`;
    nav.appendChild(li);
    highlightByTag();
}

// context menu
(function(){
  const textBlock = document.getElementById('text-block');
  const contextMenu = document.getElementById('context-menu');

  function hideMenu() {
    contextMenu.style.display = 'none';
  }

  function showMenuAt(x, y) {
    const menuW = contextMenu.offsetWidth || 160;
    const menuH = contextMenu.offsetHeight || 80;
    const pad = 8;

    let left = Math.max(pad, Math.min(x, window.innerWidth - menuW - pad));
    let top  = Math.max(pad, Math.min(y, window.innerHeight - menuH - pad));

    contextMenu.style.left = left + 'px';
    contextMenu.style.top  = top  + 'px';
    contextMenu.style.display = 'block';
  }

function tryShowMenu(forceRect = false, mouseX, mouseY) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) { hideMenu(); return; }

  const text = sel.toString().trim();
  if (!text) { hideMenu(); return; }

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) { hideMenu(); return; }

  let x, y;

  // координаты относительно документа
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  if (forceRect || ('ontouchstart' in window && (mouseX === undefined && mouseY === undefined))) {
    // всегда из выделения
    x = rect.left + rect.width / 2 + scrollX;
    y = rect.top + scrollY - contextMenu.offsetHeight - 8; // над текстом
    if (y < scrollY + 8) y = rect.bottom + scrollY + 8; // если нет места сверху — снизу
  } else {
    // ПК: около мыши
    x = (mouseX !== undefined ? mouseX : rect.left + rect.width / 2) + scrollX;
    y = (mouseY !== undefined ? mouseY : rect.bottom + 8) + scrollY;
  }

  // Ограничение по видимой области
  const menuW = contextMenu.offsetWidth || 160;
  const menuH = contextMenu.offsetHeight || 80;
  const pad = 8;

  x = Math.max(scrollX + pad, Math.min(x, scrollX + window.innerWidth - menuW - pad));
  y = Math.max(scrollY + pad, Math.min(y, scrollY + window.innerHeight - menuH - pad));

  contextMenu.style.left = x + 'px';
  contextMenu.style.top  = y + 'px';
  contextMenu.style.display = 'block';
}


  // --- ПК: показываем по mouseup ---
  textBlock.addEventListener('mouseup', (e) => {
    setTimeout(() => tryShowMenu(false, e.clientX, e.clientY), 10);
  });

  // --- Мобилки: используем selectionchange ---
  document.addEventListener('selectionchange', () => {
    if ('ontouchstart' in window) {
      setTimeout(() => tryShowMenu(true), 1);
    }
  });

  // Скрытие
  document.addEventListener('mousedown', (e) => {
    if (!contextMenu.contains(e.target)) hideMenu();
  });

  window.addEventListener('resize', hideMenu);
})();

// Функция создания плиток
function renderBooks(containerId, start, end) {
  const container = document.getElementById(containerId);
  bible['Books'].slice(start, end).forEach(book => {
  const col = document.createElement("div");
    col.className = "col-6 col-sm-4 col-md-3 col-xl-2 col-xxl-1";
    const tile = document.createElement("div");
    tile.className = "book-tile";

    // левая часть (книга → первая глава)
    const bookName = document.createElement("div");
    bookName.className = "book-name";
    bookName.textContent = book.BookName;
    bookName.onclick = () => {
      renderBibleText(book.BookName,1);
    };

    // правая часть (иконка ↓)
    const chapterSelect = document.createElement("div");
    chapterSelect.className = "bookChapterSelect";
    chapterSelect.textContent = "∇";

    // выпадающий список
    const dropdown = document.createElement("div");
    dropdown.className = "chapter-dropdown";
    for (let i = 1; i <= book.Chapters.length; i++) {
      const ch = document.createElement("div");
      ch.className = "d-inline-block";
      ch.textContent = i;
      ch.onclick = (e) => {
        e.stopPropagation();
        renderBibleText(book.BookName,i);
      };
      dropdown.appendChild(ch);
    }

    // клик по ↓ открывает/закрывает список
    chapterSelect.onclick = (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display === "block";
      document.querySelectorAll(".chapter-dropdown").forEach(d => d.style.display = "none");
      dropdown.style.display = isOpen ? "none" : "block";

      // авто-подстройка, чтобы не вылазило за экран
      const rect = dropdown.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        dropdown.style.top = "auto";
        dropdown.style.bottom = "100%";
      } else {
        dropdown.style.top = "100%";
        dropdown.style.bottom = "auto";
      }
    };

    // клик вне закрывает все меню
    document.addEventListener("click", () => {
      dropdown.style.display = "none";
    });

    tile.appendChild(bookName);
    tile.appendChild(chapterSelect);
    tile.appendChild(dropdown);
    col.appendChild(tile);
    container.appendChild(col);
  });
}
function openTestament(id) {
  const panel = document.getElementById(id);
  const isOpen = panel.classList.contains('open');

  // Сначала всё закрываем
  document.querySelector('.navbar-collapse')?.classList.remove('show');
  document.querySelectorAll('.testament-panel').forEach(p => p.classList.remove('open'));

  // Если не было открыто — открываем
  if (!isOpen) {
    panel.classList.add('open');
  }
}
