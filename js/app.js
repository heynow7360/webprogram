'use strict';

/* =============================================
   앱 상태
============================================= */
const state = {
  selectedDate:     null,   // 'YYYY-MM-DD'
  selectedStart:    null,   // 'HH:MM'
  selectedEnd:      null,   // 'HH:MM'
  durationH:        0,
  durationM:        0,
  selectedSubject:  null,
  concentration:    null,
  // 시간 피커 현재 타겟 ('start' | 'end')
  timePicking:      'start',
  // 달력 현재 표시 연월
  calYear:          new Date().getFullYear(),
  calMonth:         new Date().getMonth(),
  calSelected:      null,   // 'YYYY-MM-DD'
  // 드럼 현재 값
  drumH:            9,
  drumM:            0,
};

/* =============================================
   유틸
============================================= */
function pad(n)  { return String(n).padStart(2, '0'); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function formatDate(ds) {
  if (!ds) return '';
  const d = new Date(ds + 'T00:00:00');
  const days = ['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}
function formatDuration(h, m) {
  const parts = [];
  if (h > 0) parts.push(`${h}시간`);
  if (m > 0) parts.push(`${m}분`);
  return parts.length ? parts.join(' ') : '0분';
}

/* =============================================
   스크린 전환
============================================= */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // 폼 화면에서는 FAB 숨기기
  const fabWrap = document.getElementById('fab-wrap');
  fabWrap.style.display = (id === 'add-screen') ? 'none' : '';
  window.scrollTo(0, 0);
}

/* =============================================
   홈 — 기록 렌더링
============================================= */
function renderRecords() {
  const list  = document.getElementById('records-list');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('record-count');
  const records = Storage.getAll();

  list.innerHTML = '';

  if (records.length === 0) {
    empty.classList.remove('hidden');
    count.textContent = '';
    return;
  }
  empty.classList.add('hidden');
  count.textContent = `${records.length}개`;

  records.forEach(r => {
    const concClass = r.concentration <= 4 ? 'badge-low'
                    : r.concentration <= 7 ? 'badge-mid' : 'badge-high';
    const li = document.createElement('li');
    li.className = 'record-card';
    li.dataset.id = r.id;

    const meta = [];
    meta.push(`⏱ ${formatDuration(r.durationH, r.durationM)}`);
    if (r.startTime) {
      let t = `🕐 ${r.startTime}`;
      if (r.endTime) t += ` ~ ${r.endTime}`;
      meta.push(t);
    }
    if (r.method) meta.push(`📖 ${r.method}`);

    li.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-date">${formatDate(r.date)}</div>
          <div class="card-subject">${r.subject}</div>
        </div>
        <span class="card-badge ${concClass}">집중도 ${r.concentration}</span>
      </div>
      <div class="card-meta">${meta.map(m => `<span>${m}</span>`).join('')}</div>
      <button class="card-delete" data-id="${r.id}">삭제</button>
    `;
    list.appendChild(li);
  });

  // 삭제 버튼 (데스크톱 hover)
  list.querySelectorAll('.card-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('이 기록을 삭제할까요?')) {
        Storage.remove(btn.dataset.id);
        renderRecords();
      }
    });
  });

  // 모바일 롱프레스 삭제
  list.querySelectorAll('.record-card').forEach(card => {
    let timer = null;
    card.addEventListener('pointerdown', () => {
      timer = setTimeout(() => {
        if (confirm('이 기록을 삭제할까요?')) {
          Storage.remove(card.dataset.id);
          renderRecords();
        }
      }, 700);
    });
    card.addEventListener('pointerup',    () => clearTimeout(timer));
    card.addEventListener('pointerleave', () => clearTimeout(timer));
    card.addEventListener('pointermove',  () => clearTimeout(timer));
  });
}

/* =============================================
   FAB
============================================= */
function initFab() {
  const btn  = document.getElementById('fab-btn');
  const menu = document.getElementById('fab-menu');
  const bdp  = document.getElementById('backdrop');

  function openFab() {
    menu.classList.add('open');
    btn.classList.add('open');
    bdp.classList.add('active');
    btn.setAttribute('aria-label', '메뉴 닫기');
    menu.setAttribute('aria-hidden', 'false');
  }
  function closeFab() {
    menu.classList.remove('open');
    btn.classList.remove('open');
    bdp.classList.remove('active');
    btn.setAttribute('aria-label', '메뉴 열기');
    menu.setAttribute('aria-hidden', 'true');
  }

  btn.addEventListener('click', () => {
    menu.classList.contains('open') ? closeFab() : openFab();
  });

  bdp.addEventListener('click', () => {
    closeFab();
    closeAllModals();
  });

  document.getElementById('btn-add-study').addEventListener('click', () => {
    closeFab();
    resetForm();
    showScreen('add-screen');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeFab(); closeAllModals(); }
  });
}

/* =============================================
   모달 공통 열기/닫기
============================================= */
let _currentModal = null;

function openModal(id) {
  closeAllModals();
  _currentModal = id;
  document.getElementById(id).classList.add('open');
  document.getElementById('backdrop').classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.getElementById('backdrop').classList.remove('active');
  _currentModal = null;
}

function closeAllModals() {
  ['date-modal','time-modal','duration-modal','subject-modal'].forEach(id => {
    document.getElementById(id).classList.remove('open');
  });
  _currentModal = null;
}

// 닫기(✕) 버튼 공통
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.close) closeModal(btn.dataset.close);
  });
});

// 백드롭 클릭 → 현재 모달 닫기 (FAB 닫기는 initFab 에서 처리)
document.getElementById('backdrop').addEventListener('click', () => {
  if (_currentModal) closeModal(_currentModal);
});

/* =============================================
   달력 피커
============================================= */
function buildCalendar() {
  const grid  = document.getElementById('cal-grid');
  const label = document.getElementById('cal-label');
  const y = state.calYear, m = state.calMonth;

  label.textContent = `${y}년 ${m+1}월`;

  const firstDay    = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const todayStr    = today();

  let html = '';
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day cal-empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${pad(m+1)}-${pad(d)}`;
    const cls = ['cal-day',
      ds === todayStr          ? 'cal-today'    : '',
      ds === state.calSelected ? 'cal-selected' : '',
    ].filter(Boolean).join(' ');
    html += `<div class="${cls}" data-date="${ds}">${d}</div>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day:not(.cal-empty)').forEach(el => {
    el.addEventListener('click', () => {
      state.calSelected = el.dataset.date;
      buildCalendar();
    });
  });
}

function initDatePicker() {
  document.getElementById('trigger-date').addEventListener('click', () => {
    state.calSelected = state.selectedDate || today();
    const d = new Date(state.calSelected + 'T00:00:00');
    state.calYear  = d.getFullYear();
    state.calMonth = d.getMonth();
    buildCalendar();
    openModal('date-modal');
  });

  document.getElementById('cal-prev').addEventListener('click', () => {
    state.calMonth--;
    if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
    buildCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    state.calMonth++;
    if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
    buildCalendar();
  });

  document.getElementById('date-confirm').addEventListener('click', () => {
    if (state.calSelected) {
      state.selectedDate = state.calSelected;
      document.getElementById('display-date').textContent = formatDate(state.selectedDate);
      document.getElementById('trigger-date').classList.add('filled');
      document.getElementById('ff-date').classList.remove('shake');
    }
    closeModal('date-modal');
  });
}

/* =============================================
   드럼롤 시간 피커
============================================= */
const ITEM_H = 36;  // px per drum item
const PAD    = 2;   // ghost items for centering

function buildDrumColumn(itemsEl, scrollEl, values, currentVal, onChange) {
  // 위아래 빈 칸 (선택 항목이 가운데 오도록)
  let html = `<div class="drum-item" aria-hidden="true"></div>`.repeat(PAD);
  values.forEach(v => {
    const sel = v === currentVal ? ' selected' : '';
    html += `<div class="drum-item${sel}" data-val="${v}">${pad(v)}</div>`;
  });
  html += `<div class="drum-item" aria-hidden="true"></div>`.repeat(PAD);
  itemsEl.innerHTML = html;

  // 선택값으로 스크롤
  const idx = values.indexOf(currentVal);
  scrollEl.scrollTop = Math.max(0, idx * ITEM_H);

  // 스크롤 끝날 때 스냅
  let snapTimer = null;
  scrollEl.addEventListener('scroll', () => {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      const rawIdx  = scrollEl.scrollTop / ITEM_H;
      const snapIdx = Math.max(0, Math.min(Math.round(rawIdx), values.length - 1));
      scrollEl.scrollTop = snapIdx * ITEM_H;

      const val = values[snapIdx];
      onChange(val);
      itemsEl.querySelectorAll('.drum-item[data-val]').forEach(el => {
        el.classList.toggle('selected', Number(el.dataset.val) === val);
      });
    }, 80);
  }, { passive: true });

  // 마우스 드래그 (데스크톱)
  addMouseDrag(scrollEl);
}

function addMouseDrag(el) {
  let startY = 0, startScroll = 0, dragging = false;
  el.addEventListener('mousedown', e => {
    dragging = true;
    startY = e.clientY;
    startScroll = el.scrollTop;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    el.scrollTop = startScroll - (e.clientY - startY);
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

function openTimePicker(target) {
  state.timePicking = target;
  document.getElementById('time-modal-title').textContent =
    target === 'start' ? '시작 시간 선택' : '종료 시간 선택';

  const curVal = target === 'start' ? state.selectedStart : state.selectedEnd;
  let h = 9, m = 0;
  if (curVal) { const p = curVal.split(':').map(Number); h = p[0]; m = p[1]; }
  state.drumH = h;
  state.drumM = m;

  const hours   = Array.from({length: 24}, (_, i) => i);
  const minutes = Array.from({length: 60}, (_, i) => i);

  buildDrumColumn(
    document.getElementById('drum-h-items'),
    document.getElementById('drum-h'),
    hours, h, v => { state.drumH = v; }
  );
  buildDrumColumn(
    document.getElementById('drum-m-items'),
    document.getElementById('drum-m'),
    minutes, m, v => { state.drumM = v; }
  );

  openModal('time-modal');
}

function initTimePicker() {
  document.getElementById('trigger-start').addEventListener('click', () => openTimePicker('start'));
  document.getElementById('trigger-end').addEventListener('click',   () => openTimePicker('end'));

  document.getElementById('time-confirm').addEventListener('click', () => {
    const val = `${pad(state.drumH)}:${pad(state.drumM)}`;
    if (state.timePicking === 'start') {
      state.selectedStart = val;
      document.getElementById('display-start').textContent = val;
      document.getElementById('trigger-start').classList.add('filled');
    } else {
      state.selectedEnd = val;
      document.getElementById('display-end').textContent = val;
      document.getElementById('trigger-end').classList.add('filled');
    }
    closeModal('time-modal');
  });
}

/* =============================================
   공부시간 스피너
============================================= */
function initDurationPicker() {
  const hEl = document.getElementById('dur-h');
  const mEl = document.getElementById('dur-m');

  function sync() {
    hEl.textContent = state.durationH;
    mEl.textContent = pad(state.durationM);
  }

  document.getElementById('trigger-duration').addEventListener('click', () => {
    sync();
    openModal('duration-modal');
  });

  // 시간
  document.getElementById('hr-up').addEventListener('click', () => {
    state.durationH = Math.min(23, state.durationH + 1); sync();
  });
  document.getElementById('hr-down').addEventListener('click', () => {
    state.durationH = Math.max(0, state.durationH - 1); sync();
  });

  // 분 (5분 단위)
  document.getElementById('mn-up').addEventListener('click', () => {
    state.durationM = state.durationM >= 55 ? 0 : state.durationM + 5; sync();
  });
  document.getElementById('mn-down').addEventListener('click', () => {
    state.durationM = state.durationM <= 0 ? 55 : state.durationM - 5; sync();
  });

  document.getElementById('dur-confirm').addEventListener('click', () => {
    document.getElementById('display-duration').textContent =
      formatDuration(state.durationH, state.durationM);
    document.getElementById('trigger-duration').classList.add('filled');
    document.getElementById('ff-duration').classList.remove('shake');
    closeModal('duration-modal');
  });
}

/* =============================================
   과목 피커
============================================= */
function initSubjectPicker() {
  document.getElementById('trigger-subject').addEventListener('click', () => {
    document.querySelectorAll('.subject-item').forEach(li => {
      li.classList.toggle('picked', li.dataset.val === state.selectedSubject);
    });
    openModal('subject-modal');
  });

  document.getElementById('subject-list').addEventListener('click', e => {
    const item = e.target.closest('.subject-item');
    if (!item) return;
    state.selectedSubject = item.dataset.val;
    document.querySelectorAll('.subject-item').forEach(li => li.classList.remove('picked'));
    item.classList.add('picked');

    document.getElementById('display-subject').textContent = state.selectedSubject;
    document.getElementById('trigger-subject').classList.add('filled');
    document.getElementById('ff-subject').classList.remove('shake');
    closeModal('subject-modal');
  });
}

/* =============================================
   집중도 버튼
============================================= */
function initConcentration() {
  const grid = document.getElementById('conc-grid');
  let html = '';
  for (let i = 1; i <= 10; i++) {
    html += `<button type="button" class="conc-btn" data-val="${i}">${i}</button>`;
  }
  grid.innerHTML = html;

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.conc-btn');
    if (!btn) return;
    grid.querySelectorAll('.conc-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.concentration = parseInt(btn.dataset.val);
    document.getElementById('ff-conc').classList.remove('shake');
  });
}

/* =============================================
   폼 리셋
============================================= */
function resetForm() {
  state.selectedDate    = null;
  state.selectedStart   = null;
  state.selectedEnd     = null;
  state.durationH       = 0;
  state.durationM       = 0;
  state.selectedSubject = null;
  state.concentration   = null;

  document.getElementById('display-date').textContent     = '날짜를 선택하세요';
  document.getElementById('display-start').textContent    = '--:--';
  document.getElementById('display-end').textContent      = '--:--';
  document.getElementById('display-duration').textContent = '시간/분 선택';
  document.getElementById('display-subject').textContent  = '과목을 선택하세요';
  document.getElementById('input-method').value           = '';

  ['trigger-date','trigger-start','trigger-end','trigger-duration','trigger-subject']
    .forEach(id => document.getElementById(id).classList.remove('filled'));

  document.querySelectorAll('.conc-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.subject-item').forEach(li => li.classList.remove('picked'));
}

/* =============================================
   폼 제출
============================================= */
function shake(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;  // reflow to restart animation
  el.classList.add('shake');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function initForm() {
  document.getElementById('back-btn').addEventListener('click', () => {
    showScreen('home-screen');
    renderRecords();
  });

  document.getElementById('study-form').addEventListener('submit', e => {
    e.preventDefault();

    if (!state.selectedDate) {
      shake('ff-date'); return;
    }
    if (state.durationH === 0 && state.durationM === 0) {
      shake('ff-duration'); return;
    }
    if (!state.selectedSubject) {
      shake('ff-subject'); return;
    }
    if (!state.concentration) {
      shake('ff-conc'); return;
    }

    const record = {
      date:          state.selectedDate,
      startTime:     state.selectedStart,
      endTime:       state.selectedEnd,
      durationH:     state.durationH,
      durationM:     state.durationM,
      subject:       state.selectedSubject,
      method:        document.getElementById('input-method').value.trim(),
      concentration: state.concentration,
    };

    Storage.save(record);
    showScreen('home-screen');
    renderRecords();
  });
}

/* =============================================
   앱 초기화
============================================= */
document.addEventListener('DOMContentLoaded', () => {
  initFab();
  initDatePicker();
  initTimePicker();
  initDurationPicker();
  initSubjectPicker();
  initConcentration();
  initForm();
  renderRecords();
});
