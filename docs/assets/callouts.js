document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll('blockquote').forEach(function(block) {
    const firstP = block.querySelector('p');
    if (!firstP) return;

    // Умный поиск: находим тип, заголовок и весь остальной текст, даже если он на новых строках
    const regex = /^\[!([a-zA-Z]+)\](.*?)(?:<br>|\n|$)([\s\S]*)/i;
    const match = firstP.innerHTML.match(regex);

    if (match) {
      const type = match[1].toLowerCase();
      // Берем заголовок пользователя (например, "Важно") или ставим стандартный
      const titleText = match[2].trim() || (type.charAt(0).toUpperCase() + type.slice(1));
      const remainingContent = match[3].trim();

      // Добавляем нужные CSS-классы для цвета и рамки
      block.classList.add('obsidian-callout', `callout-${type}`);

      // Создаем красивую плашку заголовка
      const titleDiv = document.createElement('div');
      titleDiv.className = 'callout-title';
      titleDiv.innerHTML = titleText;

      // Создаем обертку для самого текста инструкции
      const contentDiv = document.createElement('div');
      contentDiv.className = 'callout-content';

      // Очищаем первый абзац от технических символов [!WARNING] и помещаем туда чистый текст
      firstP.innerHTML = remainingContent;

      // Аккуратно переносим все абзацы внутрь новой обертки
      while (block.firstChild) {
        contentDiv.appendChild(block.firstChild);
      }

      // Собираем готовый блок
      block.appendChild(titleDiv);
      block.appendChild(contentDiv);
    }
  });
});