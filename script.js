const STORAGE_KEY = 'board-state';
const FULL_SECONDS = 43199;
const LOW_TIME_THRESHOLD_SECONDS = 4 * 60 * 60;

const hasArtifactStorage = typeof window.storage !== 'undefined'
  && typeof window.storage.get === 'function'
  && typeof window.storage.set === 'function';

async function storageGet(key){
  if(hasArtifactStorage){
    try{
      const result = await window.storage.get(key, false);
      return result ? result.value : null;
    }catch(e){
      return null;
    }
  }
  try{
    return window.localStorage.getItem(key);
  }catch(e){
    return null;
  }
}

async function storageSet(key, value){
  if(hasArtifactStorage){
    try{
      await window.storage.set(key, value, false);
      return;
    }catch(e){
      console.error('window.storage save failed, falling back to localStorage', e);
    }
  }
  try{
    window.localStorage.setItem(key, value);
  }catch(e){
    console.error('localStorage save failed', e);
  }
}

const COLUMNS = [
  { id:'red',   label:'Backlog',    status:'red'   },
  { id:'amber', label:'Assigned',   status:'amber' },
  { id:'mint',  label:'Checkout',  status:'mint'  },
  { id:'green', label:'Completed',       status:'green' },
];

function defaultTasks(){
  const now = Date.now();
  const deadline = now + FULL_SECONDS * 1000;
  const shortDeadline = now + 2 * 60 * 60 * 1000;
  return [
    { id:6,  title:'Task 6',  col:'red',   deadline, owner:'Assigned', me:true },
    { id:7,  title:'Task 7',  col:'red',   deadline, owner:'Assigned', me:true },
    { id:8,  title:'Task 8',  col:'red',   deadline, owner:'Assigned', me:true },
    { id:9,  title:'Task 9',  col:'red',   deadline, owner:'Assigned', me:true },
    { id:10, title:'Task 10', col:'red',   deadline, owner:'Assigned', me:true },
    { id:5,  title:'Task 5',  col:'amber', deadline, owner:'Person 1', me:false },
    { id:4,  title:'Task 4',  col:'amber', deadline, owner:'Person 1', me:false },
    { id:2,  title:'Task 2',  col:'mint',  deadline, owner:'Person 1', me:false },
    { id:3,  title:'Task 3',  col:'mint',  deadline, owner:'Person 1', me:false },
    { id:1,  title:'Task 1',  col:'green', deadline: shortDeadline, owner:'Person 1', me:false },
  ];
}

async function loadState(){
  try{
    const raw = await storageGet(STORAGE_KEY);
    if(!raw) return { tasks: defaultTasks(), nextId: 11 };
    const parsed = JSON.parse(raw);
    if(!Array.isArray(parsed.tasks) || typeof parsed.nextId !== 'number'){
      return { tasks: defaultTasks(), nextId: 11 };
    }
    return parsed;
  }catch(e){
    return { tasks: defaultTasks(), nextId: 11 };
  }
}

async function saveState(){
  await storageSet(STORAGE_KEY, JSON.stringify({ tasks, nextId }));
}

let tasks = [];
let nextId = 11;
let isDragging = false;

function remainingSeconds(task){
  return Math.round((task.deadline - Date.now()) / 1000);
}

function getQueueDisplay(task, columnTasks){
  const isCheckout = task.col === 'mint';

  if(!isCheckout){
    if(task.pausedRemaining != null){
      task.deadline = Date.now() + task.pausedRemaining * 1000;
      task.pausedRemaining = null;
    }
    return { seconds: remainingSeconds(task), paused: false };
  }

  const isFirstInQueue = columnTasks.length > 0 && columnTasks[0].id === task.id;

  if(isFirstInQueue){
    if(task.pausedRemaining != null){
      task.deadline = Date.now() + task.pausedRemaining * 1000;
      task.pausedRemaining = null;
    }
    return { seconds: remainingSeconds(task), paused: false };
  }

  if(task.pausedRemaining == null){
    task.pausedRemaining = remainingSeconds(task);
  }
  return { seconds: task.pausedRemaining, paused: true };
}

function fmt(s){
  const neg = s < 0;
  const abs = Math.abs(Math.floor(s));
  const h = String(Math.floor(abs/3600)).padStart(2,'0');
  const m = String(Math.floor((abs%3600)/60)).padStart(2,'0');
  const sec = String(Math.floor(abs%60)).padStart(2,'0');
  return (neg ? '-' : '') + h+':'+m+':'+sec;
}

const board = document.getElementById('board');

function render(){
  board.innerHTML = '';

  COLUMNS.forEach(colDef => {
    const colTasks = tasks.filter(t => t.col === colDef.id && !t.hidden);
    if(colDef.id !== 'mint'){
      colTasks.sort((a, b) => remainingSeconds(a) - remainingSeconds(b));
    }
    colTasks.sort((a, b) => {
      const aTime = a.pausedRemaining != null ? a.pausedRemaining : remainingSeconds(a);
      const bTime = b.pausedRemaining != null ? b.pausedRemaining : remainingSeconds(b);
      return aTime - bTime;
    });

    const col = document.createElement('div');
    col.className = 'col';
    col.dataset.status = colDef.id;
    col.dataset.colid = colDef.id;

    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('dragover');
    });
    col.addEventListener('dragleave', () => col.classList.remove('dragover'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('dragover');
      const id = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const task = tasks.find(t => t.id === id);
      if(task){
        task.col = colDef.id;
        if(colDef.id === 'red'){
          task.owner = 'Assigned to me';
          task.me = true;
        }
        saveState();
        render();
      }
    });

    const header = document.createElement('div');
    header.className = 'col-header';
    header.innerHTML = `<span>${colDef.label}</span><span class="count">${colTasks.length}</span>`;
    col.appendChild(header);

    colTasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'card';
      card.draggable = true;
      card.dataset.id = task.id;

      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', task.id);
        setTimeout(() => card.classList.add('dragging'), 0);
        isDragging = true;
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        isDragging = false;
      });
      card.addEventListener('click', () => {
        openDetailView(task.id);
      });

      const { seconds: secondsLeft, paused } = getQueueDisplay(task, colTasks);
      const pct = Math.max(0, Math.min(100, (secondsLeft / FULL_SECONDS) * 100));
      const low = !paused && secondsLeft <= LOW_TIME_THRESHOLD_SECONDS;

      const checkBadge = colDef.id === 'mint'
        ? `<button class="check-badge" title="Mark complete" data-complete="${task.id}">&#10003;</button>`
        : '';

      const eyeIconOpen = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;

      const eyeBadge = colDef.id === 'red'
        ? `<button class="eye-badge" title="Hide task" data-eye-toggle="${task.id}">${eyeIconOpen}</button>`
        : '';

      const tagBtn = colDef.id === 'green'
        ? ''
        : `<button class="tag ${task.me ? 'me' : ''}" data-assign="${task.id}">${task.owner}</button>`;

      card.innerHTML = `
        <div class="card-top">
          <div class="timer ${low ? 'low' : ''} ${paused ? 'paused' : ''}" data-timer="${task.id}"><span class="tdot"></span><span data-timer-text="${task.id}">${paused ? 'Waiting &middot; ' + fmt(secondsLeft) : fmt(secondsLeft)}</span></div>
          <p class="card-title">${task.title}</p>
          <p class="card-id">ID: ${task.id}</p>
          <div class="progress-track"><div class="progress-fill ${low?'low':''} ${paused ? 'paused' : ''}" data-progress="${task.id}" style="width:${pct}%"></div></div>
        </div>
        <div class="card-bottom">
          <div style="flex:1"></div>
          <button class="remove-btn" title="Remove card" data-remove="${task.id}">&times;</button>
          ${eyeBadge}
          ${checkBadge}
          ${tagBtn}
        </div>
      `;

      col.appendChild(card);
    });

    if(colTasks.length === 0){
      const hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.textContent = 'No cards here';
      col.appendChild(hint);
    }

    if(colDef.id === 'red'){
      const trigger = document.createElement('button');
      trigger.className = 'add-trigger-btn';
      trigger.textContent = '+ Add task';
      trigger.addEventListener('click', () => openAddTaskModal());
      col.appendChild(trigger);
    }

    board.appendChild(col);
  });

  board.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(e.currentTarget.dataset.remove, 10);
      const task = tasks.find(t => t.id === id);
      if(task) openConfirmModal(task);
    });
  });

  board.querySelectorAll('[data-eye-toggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(e.currentTarget.dataset.eyeToggle, 10);
      const task = tasks.find(t => t.id === id);
      if(!task) return;
      task.hidden = true;
      saveState();
      render();
      updateHiddenBadge();
    });
  });

  board.querySelectorAll('[data-assign]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(e.currentTarget.dataset.assign, 10);
      const task = tasks.find(t => t.id === id);
      if(!task) return;
      task.owner = 'Assigned';
      task.me = true;
      task.col = 'amber';
      saveState();
      render();
    });
  });

  board.querySelectorAll('[data-complete]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(e.currentTarget.dataset.complete, 10);
      const task = tasks.find(t => t.id === id);
      if(!task) return;
      task.col = 'green';
      saveState();
      render();
    });
  });
}

function tick(){
  if(isDragging) return;
  if(currentDetailTaskId !== null){
    updateDetailTimerPill();
    return;
  }
  render();
}

const confirmModal = document.getElementById('confirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalCancel = document.getElementById('confirmModalCancel');
const confirmModalConfirm = document.getElementById('confirmModalConfirm');
let pendingDeleteId = null;

function openConfirmModal(task){
  pendingDeleteId = task.id;
  confirmModalTitle.textContent = task.title;
  confirmModal.classList.remove('hidden');
}

function closeConfirmModal(){
  pendingDeleteId = null;
  confirmModal.classList.add('hidden');
}

confirmModalCancel.addEventListener('click', closeConfirmModal);

confirmModalConfirm.addEventListener('click', () => {
  if(pendingDeleteId !== null){
    tasks = tasks.filter(t => t.id !== pendingDeleteId);
    saveState();
    render();
  }
  closeConfirmModal();
});

confirmModal.addEventListener('click', e => {
  if(e.target === confirmModal) closeConfirmModal();
});

document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && !confirmModal.classList.contains('hidden')) closeConfirmModal();
});

function updateIstClock(){
  const el = document.getElementById('istTime');
  if(!el) return;
  const istString = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
  el.textContent = istString;
}

const hiddenModal = document.getElementById('hiddenModal');
const hiddenList = document.getElementById('hiddenList');
const hiddenBadgeCount = document.getElementById('hiddenBadgeCount');
const eyeBtn = document.getElementById('eyeBtn');
const colLabelById = Object.fromEntries(COLUMNS.map(c => [c.id, c.label]));

function updateHiddenBadge(){
  const count = tasks.filter(t => t.hidden).length;
  hiddenBadgeCount.textContent = count;
  hiddenBadgeCount.classList.toggle('hidden', count === 0);
}

function renderHiddenList(){
  const hiddenTasks = tasks.filter(t => t.hidden);
  if(hiddenTasks.length === 0){
    hiddenList.innerHTML = `<div class="empty-hint" style="padding:20px 0;">No hidden tasks</div>`;
    return;
  }
  hiddenList.innerHTML = hiddenTasks.map(t => `
    <div class="hidden-item">
      <div>
        <div class="hidden-item-title">${t.title}</div>
        <div class="hidden-item-col">${colLabelById[t.col] || t.col}</div>
      </div>
      <button class="restore-btn" data-restore="${t.id}">Restore</button>
    </div>
  `).join('');

  hiddenList.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = parseInt(e.currentTarget.dataset.restore, 10);
      const task = tasks.find(t => t.id === id);
      if(!task) return;
      task.hidden = false;
      saveState();
      render();
      updateHiddenBadge();
      renderHiddenList();
    });
  });
}

eyeBtn.addEventListener('click', () => {
  renderHiddenList();
  hiddenModal.classList.remove('hidden');
});

document.getElementById('hiddenModalClose').addEventListener('click', () => {
  hiddenModal.classList.add('hidden');
});
hiddenModal.addEventListener('click', e => {
  if(e.target === hiddenModal) hiddenModal.classList.add('hidden');
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && !hiddenModal.classList.contains('hidden')) hiddenModal.classList.add('hidden');
});

const addTaskModal = document.getElementById('addTaskModal');
const addTaskTitleInput = document.getElementById('addTaskTitleInput');
const addTaskIdInput = document.getElementById('addTaskIdInput');
const addTaskError = document.getElementById('addTaskError');
const addTaskModalConfirm = document.getElementById('addTaskModalConfirm');
const addTaskModalCancel = document.getElementById('addTaskModalCancel');

function openAddTaskModal(){
  addTaskTitleInput.value = '';
  addTaskIdInput.value = '';
  addTaskError.textContent = '';
  addTaskError.classList.remove('show');
  addTaskModal.classList.remove('hidden');
  addTaskTitleInput.focus();
}

function closeAddTaskModal(){
  addTaskModal.classList.add('hidden');
}

function showAddTaskError(msg){
  addTaskError.textContent = msg;
  addTaskError.classList.add('show');
}

function submitAddTask(){
  const title = addTaskTitleInput.value.trim();
  const idRaw = addTaskIdInput.value.trim();

  if(!title){
    showAddTaskError('Please enter a task title.');
    return;
  }
  if(!idRaw){
    showAddTaskError('Please enter a task ID.');
    return;
  }
  const id = parseInt(idRaw, 10);
  if(Number.isNaN(id)){
    showAddTaskError('Task ID must be a number.');
    return;
  }
  if(tasks.some(t => t.id === id)){
    showAddTaskError('That task ID is already in use.');
    return;
  }

  tasks.push({
    id,
    title,
    col: 'red',
    deadline: Date.now() + FULL_SECONDS * 1000,
    owner: 'Assigned',
    me: true
  });
  nextId = Math.max(nextId, id + 1);
  saveState();
  render();
  closeAddTaskModal();
}

addTaskModalConfirm.addEventListener('click', submitAddTask);
addTaskModalCancel.addEventListener('click', closeAddTaskModal);
addTaskModal.addEventListener('click', e => {
  if(e.target === addTaskModal) closeAddTaskModal();
});
[addTaskTitleInput, addTaskIdInput].forEach(input => {
  input.addEventListener('keydown', e => {
    if(e.key === 'Enter'){
      e.preventDefault();
      submitAddTask();
    }
  });
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && !addTaskModal.classList.contains('hidden')) closeAddTaskModal();
});

/* ===== Task detail view ===== */

let currentDetailTaskId = null;
let currentTool = 'line';
const canvasHistoryByTask = {}; // { [taskId]: { undo: [...], redo: [...] } }

const detailView = document.getElementById('detailView');
const detailBackBtn = document.getElementById('detailBackBtn');
const detailTaskName = document.getElementById('detailTaskName');
const detailTaskId = document.getElementById('detailTaskId');
const detailTimerPill = document.getElementById('detailTimerPill');
const subtaskSidebar = document.getElementById('subtaskSidebar');
const detailRightPanel = document.getElementById('detailRightPanel');
const panelToggleIcon = document.getElementById('panelToggleIcon');
const taskCanvas = document.getElementById('taskCanvas');
const canvasCtx = taskCanvas.getContext('2d');

function ensureTaskDetailDefaults(task){
  if(!Array.isArray(task.subtaskGroups)) task.subtaskGroups = [];
  if(!Array.isArray(task.canvasShapes)) task.canvasShapes = [];
}

function getCurrentTask(){
  return tasks.find(t => t.id === currentDetailTaskId) || null;
}

function openDetailView(taskId){
  const task = tasks.find(t => t.id === taskId);
  if(!task) return;
  ensureTaskDetailDefaults(task);
  currentDetailTaskId = taskId;
  currentTool = 'line';
  if(!canvasHistoryByTask[taskId]) canvasHistoryByTask[taskId] = { undo: [], redo: [] };

  detailTaskName.textContent = task.title;
  detailTaskId.textContent = task.id;

  board.classList.add('hidden');
  detailView.classList.remove('hidden');

  renderSubtaskSidebar(task);
  setActiveTool('line');
  resizeCanvasToContainer();
  redrawCanvas();
}

function closeDetailView(){
  currentDetailTaskId = null;
  detailView.classList.add('hidden');
  board.classList.remove('hidden');
  render();
}

detailBackBtn.addEventListener('click', closeDetailView);

document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && !detailView.classList.contains('hidden')) closeDetailView();
});

detailRightPanel.addEventListener('click', () => {
  const expanded = detailRightPanel.classList.toggle('expanded');
  panelToggleIcon.innerHTML = expanded ? '&#9665; Notes panel (empty)' : '&#9655;';
});

function updateDetailTimerPill(){
  const task = getCurrentTask();
  if(!task) return;
  detailTimerPill.textContent = fmt(remainingSeconds(task));
}

/* ---- Subtask sidebar ---- */

let pendingAddGroupTarget = null;
let pendingAddSubtaskGroupId = null;

function renderSubtaskSidebar(task){
  subtaskSidebar.innerHTML = '';

  task.subtaskGroups.forEach(group => {
    const groupEl = document.createElement('div');

    const header = document.createElement('div');
    header.className = 'subtask-group-header';
    header.innerHTML = `<span>${escapeHtml(group.name)}</span><span class="count">${group.subtasks.length}</span>`;
    groupEl.appendChild(header);

    group.subtasks.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'subtask-card';
      card.innerHTML = `
        <div class="subtask-card-top">${escapeHtml(sub.title)}</div>
        <div class="subtask-card-bottom">
          <span class="subtask-icon">&#10073;&#10073;</span>
          <span class="subtask-icon">&#9724;</span>
          <span class="subtask-icon">&#9679;</span>
          <span class="subtask-timer-pill">00:00:00</span>
          <button class="subtask-remove" title="Remove subtask" data-remove-subtask="${group.id}:${sub.id}">&times;</button>
        </div>
      `;
      groupEl.appendChild(card);
    });

    const addSubBtn = document.createElement('button');
    addSubBtn.className = 'add-subtask-btn';
    addSubBtn.textContent = '+ Add subtask';
    addSubBtn.addEventListener('click', () => openAddSubtaskModal(group.id));
    groupEl.appendChild(addSubBtn);

    subtaskSidebar.appendChild(groupEl);
  });

  const addGroupBtn = document.createElement('button');
  addGroupBtn.className = 'add-group-btn';
  addGroupBtn.textContent = '+ Add subtask group';
  addGroupBtn.addEventListener('click', () => openAddGroupModal());
  subtaskSidebar.appendChild(addGroupBtn);

  subtaskSidebar.querySelectorAll('[data-remove-subtask]').forEach(btn => {
    btn.addEventListener('click', e => {
      const [groupId, subId] = e.currentTarget.dataset.removeSubtask.split(':');
      const t = getCurrentTask();
      if(!t) return;
      const group = t.subtaskGroups.find(g => String(g.id) === groupId);
      if(!group) return;
      group.subtasks = group.subtasks.filter(s => String(s.id) !== subId);
      saveState();
      renderSubtaskSidebar(t);
    });
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---- Add group modal ---- */

const addGroupModal = document.getElementById('addGroupModal');
const addGroupNameInput = document.getElementById('addGroupNameInput');
const addGroupError = document.getElementById('addGroupError');

function openAddGroupModal(){
  addGroupNameInput.value = '';
  addGroupError.textContent = '';
  addGroupModal.classList.remove('hidden');
  addGroupNameInput.focus();
}
function closeAddGroupModal(){
  addGroupModal.classList.add('hidden');
}
function submitAddGroup(){
  const task = getCurrentTask();
  if(!task) return;
  const name = addGroupNameInput.value.trim();
  if(!name){
    addGroupError.textContent = 'Please enter a group name.';
    return;
  }
  task.subtaskGroups.push({ id: 'g' + Date.now(), name, subtasks: [] });
  saveState();
  renderSubtaskSidebar(task);
  closeAddGroupModal();
}
document.getElementById('addGroupModalConfirm').addEventListener('click', submitAddGroup);
document.getElementById('addGroupModalCancel').addEventListener('click', closeAddGroupModal);
addGroupModal.addEventListener('click', e => { if(e.target === addGroupModal) closeAddGroupModal(); });
addGroupNameInput.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); submitAddGroup(); } });

/* ---- Add subtask modal ---- */

const addSubtaskModal = document.getElementById('addSubtaskModal');
const addSubtaskTitleInput = document.getElementById('addSubtaskTitleInput');
const addSubtaskIdInput = document.getElementById('addSubtaskIdInput');
const addSubtaskError = document.getElementById('addSubtaskError');

function openAddSubtaskModal(groupId){
  pendingAddSubtaskGroupId = groupId;
  addSubtaskTitleInput.value = '';
  addSubtaskIdInput.value = '';
  addSubtaskError.textContent = '';
  addSubtaskModal.classList.remove('hidden');
  addSubtaskTitleInput.focus();
}
function closeAddSubtaskModal(){
  addSubtaskModal.classList.add('hidden');
}
function submitAddSubtask(){
  const task = getCurrentTask();
  if(!task) return;
  const group = task.subtaskGroups.find(g => g.id === pendingAddSubtaskGroupId);
  if(!group) return;

  const title = addSubtaskTitleInput.value.trim();
  const id = addSubtaskIdInput.value.trim();

  if(!title){
    addSubtaskError.textContent = 'Please enter a subtask title.';
    return;
  }
  if(!id){
    addSubtaskError.textContent = 'Please enter a subtask ID.';
    return;
  }
  const idExists = task.subtaskGroups.some(g => g.subtasks.some(s => String(s.id) === id));
  if(idExists){
    addSubtaskError.textContent = 'That subtask ID is already in use.';
    return;
  }

  group.subtasks.push({ id, title });
  saveState();
  renderSubtaskSidebar(task);
  closeAddSubtaskModal();
}
document.getElementById('addSubtaskModalConfirm').addEventListener('click', submitAddSubtask);
document.getElementById('addSubtaskModalCancel').addEventListener('click', closeAddSubtaskModal);
addSubtaskModal.addEventListener('click', e => { if(e.target === addSubtaskModal) closeAddSubtaskModal(); });
[addSubtaskTitleInput, addSubtaskIdInput].forEach(inp => {
  inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); submitAddSubtask(); } });
});

/* ---- Canvas drawing tool ---- */

function setActiveTool(tool){
  currentTool = tool;
  document.getElementById('toolLine').classList.toggle('active', tool === 'line');
  document.getElementById('toolDelete').classList.toggle('active', tool === 'delete');
}
document.getElementById('toolLine').addEventListener('click', () => setActiveTool('line'));
document.getElementById('toolDelete').addEventListener('click', () => setActiveTool('delete'));

function resizeCanvasToContainer(){
  const rect = taskCanvas.parentElement.getBoundingClientRect();
  taskCanvas.width = rect.width;
  taskCanvas.height = rect.height;
}
window.addEventListener('resize', () => {
  if(currentDetailTaskId !== null){
    resizeCanvasToContainer();
    redrawCanvas();
  }
});

function redrawCanvas(previewLine){
  const task = getCurrentTask();
  if(!task) return;
  canvasCtx.clearRect(0, 0, taskCanvas.width, taskCanvas.height);
  canvasCtx.strokeStyle = '#1B1B18';
  canvasCtx.lineWidth = 2;
  canvasCtx.lineCap = 'round';

  task.canvasShapes.forEach(shape => {
    canvasCtx.beginPath();
    canvasCtx.moveTo(shape.x1, shape.y1);
    canvasCtx.lineTo(shape.x2, shape.y2);
    canvasCtx.stroke();
  });

  if(previewLine){
    canvasCtx.save();
    canvasCtx.strokeStyle = '#0B6BFF';
    canvasCtx.setLineDash([5, 4]);
    canvasCtx.beginPath();
    canvasCtx.moveTo(previewLine.x1, previewLine.y1);
    canvasCtx.lineTo(previewLine.x2, previewLine.y2);
    canvasCtx.stroke();
    canvasCtx.restore();
  }
}

function pushHistory(){
  const task = getCurrentTask();
  if(!task) return;
  const hist = canvasHistoryByTask[task.id];
  hist.undo.push(JSON.stringify(task.canvasShapes));
  hist.redo = [];
  if(hist.undo.length > 50) hist.undo.shift();
}

function distanceToSegment(px, py, x1, y1, x2, y2){
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx*dx + dy*dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

let drawStart = null;

taskCanvas.addEventListener('mousedown', e => {
  const task = getCurrentTask();
  if(!task) return;
  const rect = taskCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if(currentTool === 'line'){
    drawStart = { x, y };
  } else if(currentTool === 'delete'){
    const hitIndex = task.canvasShapes.findIndex(s => distanceToSegment(x, y, s.x1, s.y1, s.x2, s.y2) < 6);
    if(hitIndex !== -1){
      pushHistory();
      task.canvasShapes.splice(hitIndex, 1);
      saveState();
      redrawCanvas();
    }
  }
});

taskCanvas.addEventListener('mousemove', e => {
  if(!drawStart || currentTool !== 'line') return;
  const rect = taskCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  redrawCanvas({ x1: drawStart.x, y1: drawStart.y, x2: x, y2: y });
});

window.addEventListener('mouseup', e => {
  if(!drawStart || currentTool !== 'line') return;
  const task = getCurrentTask();
  if(!task){ drawStart = null; return; }
  const rect = taskCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const dist = Math.hypot(x - drawStart.x, y - drawStart.y);
  if(dist > 3){
    pushHistory();
    task.canvasShapes.push({ x1: drawStart.x, y1: drawStart.y, x2: x, y2: y });
    saveState();
  }
  drawStart = null;
  redrawCanvas();
});

document.getElementById('toolUndo').addEventListener('click', () => {
  const task = getCurrentTask();
  if(!task) return;
  const hist = canvasHistoryByTask[task.id];
  if(hist.undo.length === 0) return;
  hist.redo.push(JSON.stringify(task.canvasShapes));
  task.canvasShapes = JSON.parse(hist.undo.pop());
  saveState();
  redrawCanvas();
});

document.getElementById('toolRedo').addEventListener('click', () => {
  const task = getCurrentTask();
  if(!task) return;
  const hist = canvasHistoryByTask[task.id];
  if(hist.redo.length === 0) return;
  hist.undo.push(JSON.stringify(task.canvasShapes));
  task.canvasShapes = JSON.parse(hist.redo.pop());
  saveState();
  redrawCanvas();
});

async function init(){
  const state = await loadState();
  tasks = state.tasks;
  nextId = state.nextId;
  render();
  setInterval(tick, 1000);

  updateIstClock();
  setInterval(updateIstClock, 1000);

  updateHiddenBadge();
}

init();
