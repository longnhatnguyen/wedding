// ===== STATE =====
let templateImage = null;       // HTMLImageElement
let guestNames = [];            // string[]
let currentNameIndex = 0;
let activeTextLine = 1;         // 1, '1b', or 2
let isDragging = false;
let dragLine = 0;               // which line is being dragged (1, '1b', or 2)

// Settings per line
const lineSettings = {
  1: { posX: 50, posY: 50, fontFamily: 'Dancing Script', fontSize: 60, color: '#8B0000', bold: true, italic: false, align: 'center' },
  '1b': { posX: 50, posY: 30, fontFamily: 'Dancing Script', fontSize: 40, color: '#8B0000', bold: true, italic: false, align: 'center' },
  2: { posX: 50, posY: 60, fontFamily: 'Dancing Script', fontSize: 36, color: '#8B0000', bold: false, italic: false, align: 'center' }
};

// ===== ELEMENTS =====
const uploadArea = document.getElementById('uploadArea');
const templateInput = document.getElementById('templateInput');
const nameInput = document.getElementById('nameInput');
const nameList = document.getElementById('nameList');
const nameCount = document.getElementById('nameCount');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const canvasPlaceholder = document.getElementById('canvasPlaceholder');
const canvasNav = document.getElementById('canvasNav');
const currentNameDisplay = document.getElementById('currentNameDisplay');
const toast = document.getElementById('toast');

// ===== UPLOAD TEMPLATE =====
uploadArea.addEventListener('click', () => templateInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = '#d4af37'; });
uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadTemplate(file);
});
templateInput.addEventListener('change', e => {
  if (e.target.files[0]) loadTemplate(e.target.files[0]);
});

function loadTemplate(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      templateImage = img;
      uploadArea.classList.add('has-image');
      uploadArea.innerHTML = `
        <img src="${e.target.result}" class="upload-preview" alt="Template">
        <button class="btn-change-template" onclick="event.stopPropagation(); templateInput.click();">Đổi phôi thiệp</button>
      `;
      renderPreview();
      showToast('✅ Đã tải phôi thiệp thành công!');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ===== NAME MANAGEMENT =====
function addNames() {
  const text = nameInput.value.trim();
  if (!text) return;
  const newNames = text.split('\n').map(n => n.trim()).filter(n => n.length > 0);
  guestNames.push(...newNames);
  nameInput.value = '';
  renderNameList();
  renderPreview();
  showToast(`✅ Đã thêm ${newNames.length} tên!`);
}

// ===== EXCEL IMPORT =====
const excelInput = document.getElementById('excelInput');
excelInput.addEventListener('change', e => {
  if (e.target.files[0]) importFromExcel(e.target.files[0]);
  e.target.value = ''; // reset để có thể chọn lại cùng file
});

function importFromExcel(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      // Lấy sheet đầu tiên
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Đọc toàn bộ dữ liệu, bắt đầu từ dòng 2 (bỏ header A1)
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      // Lấy cột A (index 0), từ dòng 2 trở đi (index 1)
      const names = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row && row[0] !== undefined && row[0] !== null) {
          const name = capitalizeWords(String(row[0]).trim());
          if (name.length > 0) {
            names.push(name);
          }
        }
      }

      if (names.length === 0) {
        showToast('⚠️ Không tìm thấy tên nào trong cột A!');
        return;
      }

      guestNames.push(...names);
      renderNameList();
      renderPreview();
      showToast(`📊 Đã import ${names.length} tên từ Excel!`);
    } catch (err) {
      console.error('Excel import error:', err);
      showToast('❌ Lỗi đọc file Excel! Vui lòng kiểm tra lại file.');
    }
  };
  reader.readAsArrayBuffer(file);
}

function removeName(index) {
  guestNames.splice(index, 1);
  if (currentNameIndex >= guestNames.length) currentNameIndex = Math.max(0, guestNames.length - 1);
  renderNameList();
  renderPreview();
}

function clearAllNames() {
  if (guestNames.length === 0) return;
  if (!confirm('Xóa toàn bộ danh sách tên?')) return;
  guestNames = [];
  currentNameIndex = 0;
  renderNameList();
  renderPreview();
  showToast('🗑️ Đã xóa toàn bộ danh sách!');
}

function selectName(index) {
  currentNameIndex = index;
  renderNameList();
  renderPreview();
}

function renderNameList() {
  nameCount.textContent = guestNames.length;
  nameList.innerHTML = guestNames.map((name, i) => `
    <div class="name-item ${i === currentNameIndex ? 'active' : ''}" onclick="selectName(${i})">
      <span class="name-item-index">${i + 1}.</span>
      <span class="name-item-text">${escapeHtml(name)}</span>
      <div class="name-item-actions">
        <button onclick="event.stopPropagation(); editName(${i})" title="Sửa">✏️</button>
        <button onclick="event.stopPropagation(); removeName(${i})" title="Xóa">❌</button>
      </div>
    </div>
  `).join('');
  canvasNav.style.display = guestNames.length > 0 ? 'flex' : 'none';
  updateNameDisplay();
}

function editName(index) {
  const newName = prompt('Sửa tên:', guestNames[index]);
  if (newName !== null && newName.trim()) {
    guestNames[index] = newName.trim();
    renderNameList();
    renderPreview();
  }
}

function prevName() {
  if (guestNames.length === 0) return;
  currentNameIndex = (currentNameIndex - 1 + guestNames.length) % guestNames.length;
  renderNameList();
  renderPreview();
}

function nextName() {
  if (guestNames.length === 0) return;
  currentNameIndex = (currentNameIndex + 1) % guestNames.length;
  renderNameList();
  renderPreview();
}

function updateNameDisplay() {
  if (guestNames.length === 0) {
    currentNameDisplay.textContent = '-';
  } else {
    currentNameDisplay.textContent = `${currentNameIndex + 1}/${guestNames.length}: ${guestNames[currentNameIndex]}`;
  }
}

// ===== CANVAS PREVIEW & RENDERING =====
function renderPreview() {
  if (!templateImage) {
    canvas.classList.add('hidden');
    canvasPlaceholder.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  canvasPlaceholder.classList.add('hidden');

  canvas.width = templateImage.naturalWidth;
  canvas.height = templateImage.naturalHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(templateImage, 0, 0);

  // Draw text line 1 (name) at position 1
  if (guestNames.length > 0) {
    drawTextLine(guestNames[currentNameIndex], lineSettings[1]);

    // Draw same name at position 1b if enabled
    const enableNamePos2 = document.getElementById('enableNamePos2').checked;
    if (enableNamePos2) {
      drawTextLine(guestNames[currentNameIndex], lineSettings['1b']);
    }
  }

  // Draw text line 2 (optional)
  const enableLine2 = document.getElementById('enableLine2').checked;
  if (enableLine2) {
    const line2Text = document.getElementById('line2Text').value;
    if (line2Text.trim()) {
      drawTextLine(line2Text, lineSettings[2]);
    }
  }

  updateNameDisplay();
}

function drawTextLine(text, settings) {
  const { posX, posY, fontFamily, fontSize, color, bold, italic, align } = settings;

  // Scale font size relative to canvas
  const scaledFontSize = Math.round(fontSize * (canvas.width / 800));

  let fontStr = '';
  if (italic) fontStr += 'italic ';
  if (bold) fontStr += 'bold ';
  fontStr += `${scaledFontSize}px '${fontFamily}'`;

  ctx.font = fontStr;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  const x = (posX / 100) * canvas.width;
  const y = (posY / 100) * canvas.height;

  // Optional shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.fillText(text, x, y);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// ===== DRAG & DROP TEXT ON CANVAS =====
canvas.addEventListener('mousedown', onCanvasMouseDown);
canvas.addEventListener('mousemove', onCanvasMouseMove);
canvas.addEventListener('mouseup', onCanvasMouseUp);
canvas.addEventListener('mouseleave', onCanvasMouseUp);

// Touch support
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const touch = e.touches[0];
  onCanvasMouseDown(touchToMouse(touch));
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const touch = e.touches[0];
  onCanvasMouseMove(touchToMouse(touch));
}, { passive: false });
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  onCanvasMouseUp();
}, { passive: false });

function touchToMouse(touch) {
  const rect = canvas.getBoundingClientRect();
  return { clientX: touch.clientX, clientY: touch.clientY, target: canvas };
}

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function onCanvasMouseDown(e) {
  const coords = getCanvasCoords(e);
  const pxX = coords.x;
  const pxY = coords.y;

  const enableLine2 = document.getElementById('enableLine2').checked;
  const enableNamePos2 = document.getElementById('enableNamePos2').checked;
  const hitRadius = 40 * (canvas.width / 800);

  // Build list of draggable lines with priorities
  const candidates = [];

  // Line 2
  if (enableLine2) {
    const l2y = (lineSettings[2].posY / 100) * canvas.height;
    candidates.push({ line: 2, dist: Math.abs(pxY - l2y) });
  }

  // Line 1b (name position 2)
  if (enableNamePos2) {
    const l1by = (lineSettings['1b'].posY / 100) * canvas.height;
    candidates.push({ line: '1b', dist: Math.abs(pxY - l1by) });
  }

  // Line 1 (name position 1)
  const l1y = (lineSettings[1].posY / 100) * canvas.height;
  candidates.push({ line: 1, dist: Math.abs(pxY - l1y) });

  // Pick closest within hitRadius
  candidates.sort((a, b) => a.dist - b.dist);
  if (candidates.length > 0 && candidates[0].dist < hitRadius) {
    isDragging = true;
    dragLine = candidates[0].line;
  } else {
    // Default to line 1 if nothing else matches
    isDragging = true;
    dragLine = 1;
  }
}

function onCanvasMouseMove(e) {
  if (!isDragging) return;
  const coords = getCanvasCoords(e);
  const newPosX = parseFloat(((coords.x / canvas.width) * 100).toFixed(1));
  const newPosY = parseFloat(((coords.y / canvas.height) * 100).toFixed(1));

  lineSettings[dragLine].posX = Math.max(0, Math.min(100, newPosX));
  lineSettings[dragLine].posY = Math.max(0, Math.min(100, newPosY));

  // If this is the active line, update UI inputs
  if (dragLine === activeTextLine) {
    document.getElementById('posX').value = lineSettings[dragLine].posX;
    document.getElementById('posY').value = lineSettings[dragLine].posY;
  }

  renderPreview();
}

function onCanvasMouseUp() {
  isDragging = false;
  dragLine = 0;
}

// ===== TEXT STYLE CONTROLS =====
function toggleStyle(style) {
  const settings = lineSettings[activeTextLine];
  if (style === 'bold') {
    settings.bold = !settings.bold;
    document.getElementById('toggleBold').classList.toggle('active', settings.bold);
  } else if (style === 'italic') {
    settings.italic = !settings.italic;
    document.getElementById('toggleItalic').classList.toggle('active', settings.italic);
  }
  renderPreview();
}

function setAlign(align) {
  lineSettings[activeTextLine].align = align;
  document.getElementById('alignLeft').classList.toggle('active', align === 'left');
  document.getElementById('alignCenter').classList.toggle('active', align === 'center');
  document.getElementById('alignRight').classList.toggle('active', align === 'right');
  renderPreview();
}

function syncColorHex() {
  document.getElementById('fontColorHex').value = document.getElementById('fontColor').value;
  lineSettings[activeTextLine].color = document.getElementById('fontColor').value;
}

function syncColorPicker() {
  const hex = document.getElementById('fontColorHex').value;
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    document.getElementById('fontColor').value = hex;
    lineSettings[activeTextLine].color = hex;
  }
}

// Listen to input changes for active line
document.getElementById('fontFamily').addEventListener('change', () => {
  lineSettings[activeTextLine].fontFamily = document.getElementById('fontFamily').value;
});
document.getElementById('fontSize').addEventListener('change', () => {
  lineSettings[activeTextLine].fontSize = parseInt(document.getElementById('fontSize').value) || 60;
});
document.getElementById('posX').addEventListener('change', () => {
  lineSettings[activeTextLine].posX = parseFloat(document.getElementById('posX').value) || 50;
});
document.getElementById('posY').addEventListener('change', () => {
  lineSettings[activeTextLine].posY = parseFloat(document.getElementById('posY').value) || 50;
});

// ===== TEXT LINE TABS =====
function switchTextLine(line) {
  activeTextLine = line;
  document.querySelectorAll('.text-line-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.line == line);
  });
  // Show/hide line2 text input
  const line2TextGroup = document.getElementById('line2TextGroup');
  line2TextGroup.classList.toggle('hidden', line != 2);
  loadLineSettingsToUI(line);
}

function loadLineSettingsToUI(line) {
  const s = lineSettings[line];
  document.getElementById('fontFamily').value = s.fontFamily;
  document.getElementById('fontSize').value = s.fontSize;
  document.getElementById('fontColor').value = s.color;
  document.getElementById('fontColorHex').value = s.color;
  document.getElementById('posX').value = s.posX;
  document.getElementById('posY').value = s.posY;
  document.getElementById('toggleBold').classList.toggle('active', s.bold);
  document.getElementById('toggleItalic').classList.toggle('active', s.italic);
  document.getElementById('alignLeft').classList.toggle('active', s.align === 'left');
  document.getElementById('alignCenter').classList.toggle('active', s.align === 'center');
  document.getElementById('alignRight').classList.toggle('active', s.align === 'right');
}

function toggleLine2() {
  const enabled = document.getElementById('enableLine2').checked;
  document.getElementById('tabLine2').style.display = enabled ? '' : 'none';
  if (!enabled && activeTextLine === 2) {
    switchTextLine(1);
  }
  if (!enabled) {
    document.getElementById('line2TextGroup').classList.add('hidden');
  }
  renderPreview();
}

function toggleNamePos2() {
  const enabled = document.getElementById('enableNamePos2').checked;
  document.getElementById('tabNamePos2').style.display = enabled ? '' : 'none';
  if (!enabled && activeTextLine === '1b') {
    switchTextLine(1);
  }
  renderPreview();
}

// ===== EXPORT =====
async function exportAll() {
  if (!templateImage) {
    showToast('⚠️ Vui lòng upload phôi thiệp trước!');
    return;
  }
  if (guestNames.length === 0) {
    showToast('⚠️ Vui lòng thêm tên khách mời!');
    return;
  }

  const exportBtn = document.getElementById('exportBtn');
  const progressEl = document.getElementById('exportProgress');
  const progressFill = document.getElementById('progressBarFill');
  const progressText = document.getElementById('progressText');
  const format = document.getElementById('exportFormat').value;
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'jpeg' ? 0.92 : undefined;

  exportBtn.disabled = true;
  exportBtn.textContent = '⏳ Đang xử lý...';
  progressEl.classList.remove('hidden');
  progressFill.style.width = '0%';

  const zip = new JSZip();
  const offCanvas = document.createElement('canvas');
  offCanvas.width = templateImage.naturalWidth;
  offCanvas.height = templateImage.naturalHeight;
  const offCtx = offCanvas.getContext('2d');

  const enableLine2 = document.getElementById('enableLine2').checked;
  const line2Text = document.getElementById('line2Text').value;

  for (let i = 0; i < guestNames.length; i++) {
    const name = guestNames[i];

    // Draw template
    offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
    offCtx.drawImage(templateImage, 0, 0);

    // Draw name (line 1)
    drawTextLineOnCtx(offCtx, offCanvas, name, lineSettings[1]);

    // Draw name at position 1b if enabled
    const enableNamePos2 = document.getElementById('enableNamePos2').checked;
    if (enableNamePos2) {
      drawTextLineOnCtx(offCtx, offCanvas, name, lineSettings['1b']);
    }

    // Draw line 2 if enabled
    if (enableLine2 && line2Text.trim()) {
      drawTextLineOnCtx(offCtx, offCanvas, line2Text, lineSettings[2]);
    }

    // Convert to blob
    const blob = await new Promise(resolve => offCanvas.toBlob(resolve, mimeType, quality));
    const safeName = name.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s_-]/g, '').replace(/\s+/g, '_');
    zip.file(`thiep_${String(i + 1).padStart(3, '0')}_${safeName}.${format}`, blob);

    // Update progress
    const pct = Math.round(((i + 1) / guestNames.length) * 100);
    progressFill.style.width = pct + '%';
    progressText.textContent = `${i + 1} / ${guestNames.length} thiệp (${pct}%)`;

    // Yield to keep UI responsive
    await new Promise(r => setTimeout(r, 10));
  }

  progressText.textContent = 'Đang nén file ZIP...';
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `thiep_cuoi_${guestNames.length}_khach.zip`);

  exportBtn.disabled = false;
  exportBtn.textContent = '📥 Tải xuống tất cả thiệp (ZIP)';
  progressFill.style.width = '100%';
  progressText.textContent = `✅ Hoàn tất! Đã xuất ${guestNames.length} thiệp.`;
  showToast(`🎉 Đã xuất ${guestNames.length} thiệp cưới!`);

  setTimeout(() => { progressEl.classList.add('hidden'); }, 4000);
}

function drawTextLineOnCtx(c, cvs, text, settings) {
  const { posX, posY, fontFamily, fontSize, color, bold, italic, align } = settings;
  const scaledFontSize = Math.round(fontSize * (cvs.width / 800));

  let fontStr = '';
  if (italic) fontStr += 'italic ';
  if (bold) fontStr += 'bold ';
  fontStr += `${scaledFontSize}px '${fontFamily}'`;

  c.font = fontStr;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';

  const x = (posX / 100) * cvs.width;
  const y = (posY / 100) * cvs.height;

  c.shadowColor = 'rgba(0,0,0,0.15)';
  c.shadowBlur = 4;
  c.shadowOffsetX = 1;
  c.shadowOffsetY = 1;

  c.fillText(text, x, y);

  c.shadowColor = 'transparent';
  c.shadowBlur = 0;
  c.shadowOffsetX = 0;
  c.shadowOffsetY = 0;
}

// ===== TOAST =====
function showToast(msg) {
  toast.innerHTML = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== UTILITY =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Viết hoa chữ cái đầu mỗi từ: "anh vũ" -> "Anh Vũ"
function capitalizeWords(str) {
  return str.replace(/\S+/g, word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

// Handle Enter key in name textarea
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    addNames();
  }
});

// Init
loadLineSettingsToUI(1);
