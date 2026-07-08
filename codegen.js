/* Обёртки над vendor/qrcode.min.js (qrcode-generator) и vendor/jsbarcode.min.js */

function renderQR(container, text) {
  container.innerHTML = '';
  if (!text) return;
  try {
    const qr = qrcode(0, 'M'); // typeNumber 0 = автоопределение размера
    qr.addData(text);
    qr.make();
    container.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
    const svg = container.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.display = 'block';
    }
  } catch (e) {
    console.error('Ошибка генерации QR-кода', e);
    container.innerHTML = '<p class="code-error">Не удалось создать QR-код для этого значения</p>';
  }
}

function renderBarcode(container, text, format) {
  container.innerHTML = '';
  if (!text) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  container.appendChild(svg);
  try {
    // Цвета зафиксированы (тёмный штрих на белом) намеренно: код должен
    // уверенно сканироваться на кассе независимо от темы устройства.
    JsBarcode(svg, text, {
      format: format || 'CODE128',
      lineColor: '#1C1C1E',
      background: 'transparent',
      width: 2,
      height: 90,
      margin: 8,
      displayValue: false,
      valid: function (valid) {
        if (!valid) {
          container.innerHTML = '<p class="code-error">Значение не подходит для формата ' + (format || 'CODE128') + '</p>';
        }
      }
    });
  } catch (e) {
    console.error('Ошибка генерации штрих-кода', e);
    container.innerHTML = '<p class="code-error">Не удалось создать штрих-код для этого значения</p>';
  }
}
