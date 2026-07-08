(function () {
  'use strict';

  /* ---------- State ---------- */
  let cards = loadCards();
  let editingId = null;      // id карты, которая редактируется (null = создание новой)
  let sheetCardId = null;    // id карты, для которой открыто меню действий
  let selectedColor = null;
  let selectedCodeType = 'qr';
  let photoDataUrl = null;

  const COLORS = [
    ['#0057FF', '#0033A0'],
    ['#32D74B', '#1E9E37'],
    ['#64D2FF', '#0091D6'],
    ['#BF5AF2', '#8A2FC4'],
    ['#FF375F', '#C41B45'],
    ['#5E5CE6', '#3A38B0'],
    ['#00C7BE', '#009690'],
    ['#FFD60A', '#C9A400']
  ];

  /* ---------- DOM refs ---------- */
  const stackEl = document.getElementById('stack');
  const emptyStateEl = document.getElementById('emptyState');
  const addBtn = document.getElementById('addBtn');

  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const actionSheet = document.getElementById('actionSheet');
  const actionEdit = document.getElementById('actionEdit');
  const actionDelete = document.getElementById('actionDelete');
  const actionCancel = document.getElementById('actionCancel');

  const confirmBackdrop = document.getElementById('confirmBackdrop');
  const confirmSheet = document.getElementById('confirmSheet');
  const confirmDelete = document.getElementById('confirmDelete');
  const confirmCancel = document.getElementById('confirmCancel');

  const formOverlay = document.getElementById('formOverlay');
  const cardForm = document.getElementById('cardForm');
  const formTitle = document.getElementById('formTitle');
  const formCancel = document.getElementById('formCancel');

  const nameInput = document.getElementById('nameInput');
  const brandInput = document.getElementById('brandInput');
  const codeValueInput = document.getElementById('codeValueInput');
  const colorSwatchesEl = document.getElementById('colorSwatches');
  const codeTypeSeg = document.getElementById('codeTypeSeg');
  const barcodeFormatGroup = document.getElementById('barcodeFormatGroup');
  const barcodeFormatSelect = document.getElementById('barcodeFormat');

  const photoInput = document.getElementById('photoInput');
  const photoPreview = document.getElementById('photoPreview');
  const photoRemove = document.getElementById('photoRemove');

  const previewCard = document.getElementById('previewCard');
  const previewName = document.getElementById('previewName');
  const previewBrand = document.getElementById('previewBrand');

  const toastEl = document.getElementById('toast');

  const zoomOverlay = document.getElementById('zoomOverlay');
  const zoomClose = document.getElementById('zoomClose');
  const zoomCardName = document.getElementById('zoomCardName');
  const zoomCodeArea = document.getElementById('zoomCodeArea');
  const zoomCodeValue = document.getElementById('zoomCodeValue');

  const backupBtn = document.getElementById('backupBtn');
  const backupBackdrop = document.getElementById('backupBackdrop');
  const backupSheet = document.getElementById('backupSheet');
  const exportAction = document.getElementById('exportAction');
  const importAction = document.getElementById('importAction');
  const backupCancel = document.getElementById('backupCancel');
  const importInput = document.getElementById('importInput');

  /* ---------- Utils ---------- */
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => { toastEl.hidden = true; }, 250);
    }, 1800);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  function resizeImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxSize) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          } else if (height > maxSize) {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality || 0.85));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Rendering the stack ---------- */
  const zoomIconSvg = '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M20 20l-4.5-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function render() {
    stackEl.innerHTML = '';
    emptyStateEl.hidden = cards.length !== 0;

    cards.forEach((card) => {
      const wrap = document.createElement('div');
      wrap.className = 'card-wrap';

      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = card.id;

      const [c1, c2] = card.color || COLORS[0];

      const front = document.createElement('div');
      front.className = 'card-face card-front';
      if (card.image) {
        front.classList.add('has-image');
        front.style.backgroundImage = `url("${card.image}")`;
      } else {
        front.style.setProperty('--c1', c1);
        front.style.setProperty('--c2', c2);
      }
      front.innerHTML = `
        <div class="card-front-content">
          <div class="card-name">${escapeHtml(card.name)}</div>
          ${card.brand ? `<div class="card-brand">${escapeHtml(card.brand)}</div>` : ''}
        </div>`;

      const back = document.createElement('div');
      back.className = 'card-face card-back';
      back.innerHTML = `
        <div class="code-area" data-type="${card.codeType}"></div>
        <div class="code-value">${escapeHtml(card.codeValue)}</div>`;

      el.appendChild(front);
      el.appendChild(back);

      // Кнопки лупы и меню — НЕ внутри вращающейся .card, а рядом с ней,
      // поверх .card-wrap. Раньше они лежали на обеих гранях карты и
      // "переворачивались" вместе с ней в 3D — из-за этого при флипе
      // иконки визуально путались местами. Теперь кнопки всегда в одном
      // и том же месте и никогда не участвуют в 3D-повороте.
      const zoomBtn = document.createElement('button');
      zoomBtn.type = 'button';
      zoomBtn.className = 'card-zoom';
      zoomBtn.setAttribute('aria-label', 'Открыть код на весь экран');
      zoomBtn.innerHTML = zoomIconSvg;

      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'card-menu';
      menuBtn.setAttribute('aria-label', 'Действия с картой');
      menuBtn.innerHTML = '&#8942;';

      wrap.appendChild(el);
      wrap.appendChild(zoomBtn);
      wrap.appendChild(menuBtn);
      stackEl.appendChild(wrap);

      // flip handling — клик по самой карте (не по кнопкам, они теперь
      // отдельные соседние элементы и не всплывают сюда)
      el.addEventListener('click', () => {
        const flipping = !el.classList.contains('is-flipped');
        el.classList.toggle('is-flipped');
        wrap.classList.toggle('is-flipped', flipping);
        if (flipping) {
          const area = back.querySelector('.code-area');
          if (!area.dataset.rendered) {
            if (card.codeType === 'barcode') {
              renderBarcode(area, card.codeValue, card.barcodeFormat);
            } else {
              renderQR(area, card.codeValue);
            }
            area.dataset.rendered = '1';
          }
        }
      });

      menuBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openActionSheet(card.id);
      });

      zoomBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openZoom(card);
      });
    });
  }


  /* ---------- Полноэкранный просмотр кода (лупа) ---------- */
  // Реальный доступ к регулировке яркости экрана браузерам недоступен —
  // ни один Web API этого не даёт (в т.ч. в Safari на iOS). Вместо этого
  // показываем код на сплошном белом фоне на весь экран — это максимально
  // повышает контраст и субъективную яркость для сканера на кассе.
  function openZoom(card) {
    zoomCardName.textContent = card.name;
    zoomCodeValue.textContent = card.codeValue;
    zoomCodeArea.dataset.type = card.codeType;
    if (card.codeType === 'barcode') {
      renderBarcode(zoomCodeArea, card.codeValue, card.barcodeFormat);
    } else {
      renderQR(zoomCodeArea, card.codeValue);
    }
    zoomOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeZoom() {
    zoomOverlay.hidden = true;
    document.body.style.overflow = '';
  }
  zoomClose.addEventListener('click', closeZoom);
  zoomOverlay.addEventListener('click', (ev) => { if (ev.target === zoomOverlay) closeZoom(); });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!zoomOverlay.hidden) closeZoom();
    else if (!formOverlay.hidden) closeForm();
    else if (!confirmSheet.hidden) { closeConfirm(); sheetCardId = null; }
    else if (!actionSheet.hidden) closeActionSheet();
    else if (!backupSheet.hidden) closeBackupSheet();
  });

  /* ---------- Резервная копия: экспорт / импорт ---------- */
  // localStorage может быть очищен вручную (Настройки → Safari → Данные
  // веб-сайтов), при переустановке PWA или сбросе устройства — это
  // единственная защита без собственного сервера.
  function closeBackupSheet() {
    backupBackdrop.hidden = true;
    backupSheet.hidden = true;
  }
  backupBtn.addEventListener('click', () => {
    backupBackdrop.hidden = false;
    backupSheet.hidden = false;
  });
  backupBackdrop.addEventListener('click', closeBackupSheet);
  backupCancel.addEventListener('click', closeBackupSheet);

  exportAction.addEventListener('click', () => {
    closeBackupSheet();
    if (cards.length === 0) {
      showToast('Пока нет карт для экспорта');
      return;
    }
    const payload = {
      app: 'wallet-pwa',
      version: 1,
      exportedAt: new Date().toISOString(),
      cards
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `wallet-pwa-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('Резервная копия сохранена');
  });

  importAction.addEventListener('click', () => {
    closeBackupSheet();
    importInput.value = '';
    importInput.click();
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const incoming = Array.isArray(data) ? data : data.cards;
      if (!Array.isArray(incoming)) throw new Error('Неверный формат файла');

      let added = 0;
      incoming.forEach((raw) => {
        if (!raw || typeof raw !== 'object') return;
        const name = String(raw.name || '').trim();
        const codeValue = String(raw.codeValue || '').trim();
        if (!name || !codeValue) return; // пропускаем повреждённые записи
        cards.push({
          id: uid(), // новый id, чтобы не пересекаться с уже существующими картами
          name,
          brand: String(raw.brand || ''),
          color: Array.isArray(raw.color) && raw.color.length === 2 ? raw.color : COLORS[0],
          image: typeof raw.image === 'string' ? raw.image : null,
          codeType: raw.codeType === 'barcode' ? 'barcode' : 'qr',
          codeValue,
          barcodeFormat: raw.barcodeFormat || 'CODE128',
          createdAt: raw.createdAt || Date.now(),
          updatedAt: Date.now()
        });
        added++;
      });

      if (added === 0) {
        showToast('В файле не найдено карт');
        return;
      }
      saveCards(cards);
      render();
      showToast(`Импортировано карт: ${added}`);
    } catch (e) {
      console.error('Ошибка импорта резервной копии', e);
      showToast('Не удалось прочитать файл резервной копии');
    }
  });

  // Просим браузер по возможности не удалять данные сайта при нехватке
  // места на устройстве. На iOS Safari эффект ограничен, но это
  // дополнительная (не единственная) линия защиты — основная это экспорт.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  /* ---------- Action sheet (edit/delete) ---------- */
  function openActionSheet(id) {
    sheetCardId = id;
    sheetBackdrop.hidden = false;
    actionSheet.hidden = false;
  }
  function closeActionSheet() {
    sheetBackdrop.hidden = true;
    actionSheet.hidden = true;
    sheetCardId = null;
  }
  sheetBackdrop.addEventListener('click', closeActionSheet);
  actionCancel.addEventListener('click', closeActionSheet);
  actionEdit.addEventListener('click', () => {
    const id = sheetCardId;
    closeActionSheet();
    openForm(id);
  });
  actionDelete.addEventListener('click', () => {
    const id = sheetCardId;
    closeActionSheet();
    sheetCardId = id;
    confirmBackdrop.hidden = false;
    confirmSheet.hidden = false;
  });

  function closeConfirm() {
    confirmBackdrop.hidden = true;
    confirmSheet.hidden = true;
  }
  confirmBackdrop.addEventListener('click', () => { closeConfirm(); sheetCardId = null; });
  confirmCancel.addEventListener('click', () => { closeConfirm(); sheetCardId = null; });
  confirmDelete.addEventListener('click', () => {
    cards = cards.filter(c => c.id !== sheetCardId);
    saveCards(cards);
    render();
    closeConfirm();
    sheetCardId = null;
    showToast('Карта удалена');
  });

  /* ---------- Form: add / edit ---------- */
  function buildColorSwatches() {
    colorSwatchesEl.innerHTML = '';
    COLORS.forEach(pair => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.background = `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
      btn.addEventListener('click', () => {
        selectedColor = pair;
        updateColorSelectionUI();
        updatePreview();
      });
      btn.dataset.c1 = pair[0];
      colorSwatchesEl.appendChild(btn);
    });
  }
  function updateColorSelectionUI() {
    [...colorSwatchesEl.children].forEach(btn => {
      btn.classList.toggle('selected', selectedColor && btn.dataset.c1 === selectedColor[0]);
    });
  }

  function updatePreview() {
    previewName.textContent = nameInput.value || 'Название';
    previewBrand.textContent = brandInput.value || '';
    previewBrand.style.display = brandInput.value ? '' : 'none';
    const front = previewCard.querySelector('.card-front');
    if (photoDataUrl) {
      front.classList.add('has-image');
      front.style.backgroundImage = `url("${photoDataUrl}")`;
    } else {
      front.classList.remove('has-image');
      front.style.backgroundImage = '';
      const [c1, c2] = selectedColor || COLORS[0];
      front.style.setProperty('--c1', c1);
      front.style.setProperty('--c2', c2);
    }
  }

  function setCodeType(type) {
    selectedCodeType = type;
    [...codeTypeSeg.children].forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
    barcodeFormatGroup.hidden = type !== 'barcode';
  }
  codeTypeSeg.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.seg-btn');
    if (btn) setCodeType(btn.dataset.type);
  });

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    try {
      photoDataUrl = await resizeImage(file, 800, 0.85);
      photoPreview.style.backgroundImage = `url("${photoDataUrl}")`;
      photoPreview.innerHTML = '';
      photoRemove.hidden = false;
      updatePreview();
    } catch (e) {
      showToast('Не удалось загрузить фото');
    }
  });
  photoRemove.addEventListener('click', () => {
    photoDataUrl = null;
    photoInput.value = '';
    photoPreview.style.backgroundImage = '';
    photoPreview.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 7h3l2-2h6l2 2h3v12H4z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`;
    photoRemove.hidden = true;
    updatePreview();
  });

  nameInput.addEventListener('input', updatePreview);
  brandInput.addEventListener('input', updatePreview);

  function openForm(id) {
    editingId = id || null;
    const card = id ? cards.find(c => c.id === id) : null;

    formTitle.textContent = card ? 'Изменить карту' : 'Новая карта';
    nameInput.value = card ? card.name : '';
    brandInput.value = card ? (card.brand || '') : '';
    codeValueInput.value = card ? card.codeValue : '';
    selectedColor = card ? card.color : COLORS[0];
    photoDataUrl = card ? (card.image || null) : null;
    setCodeType(card ? card.codeType : 'qr');
    barcodeFormatSelect.value = card && card.barcodeFormat ? card.barcodeFormat : 'CODE128';

    if (photoDataUrl) {
      photoPreview.style.backgroundImage = `url("${photoDataUrl}")`;
      photoPreview.innerHTML = '';
      photoRemove.hidden = false;
    } else {
      photoPreview.style.backgroundImage = '';
      photoPreview.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 7h3l2-2h6l2 2h3v12H4z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`;
      photoRemove.hidden = true;
    }
    photoInput.value = '';

    buildColorSwatches();
    updateColorSelectionUI();
    updatePreview();

    formOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => nameInput.focus({ preventScroll: true }), 300);
  }

  function closeForm() {
    formOverlay.hidden = true;
    document.body.style.overflow = '';
    cardForm.reset();
    editingId = null;
  }

  addBtn.addEventListener('click', () => openForm(null));
  formCancel.addEventListener('click', closeForm);
  formOverlay.addEventListener('click', (ev) => { if (ev.target === formOverlay) closeForm(); });

  cardForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = nameInput.value.trim();
    const codeValue = codeValueInput.value.trim();
    if (!name) { nameInput.focus(); showToast('Введите название карты'); return; }
    if (!codeValue) { codeValueInput.focus(); showToast('Введите значение кода'); return; }

    const data = {
      name,
      brand: brandInput.value.trim(),
      color: selectedColor || COLORS[0],
      image: photoDataUrl || null,
      codeType: selectedCodeType,
      codeValue,
      barcodeFormat: selectedCodeType === 'barcode' ? barcodeFormatSelect.value : null,
      updatedAt: Date.now()
    };

    if (editingId) {
      const idx = cards.findIndex(c => c.id === editingId);
      if (idx !== -1) cards[idx] = { ...cards[idx], ...data };
      showToast('Карта обновлена');
    } else {
      cards.push({ id: uid(), createdAt: Date.now(), ...data });
      showToast('Карта добавлена');
    }
    saveCards(cards);
    render();
    closeForm();
  });

  /* ---------- Init ---------- */
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
})();
