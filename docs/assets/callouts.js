document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll('blockquote').forEach(function(block) {
    const firstP = block.querySelector('p');
    if (!firstP) return;

    // Ищем шаблон [!ТИП] Заголовок
    const match = firstP.innerHTML.match(/^\[!([a-zA-Z]+)\](.*)/);

    if (match) {
      const type = match[1].toLowerCase();
      // Если своего заголовка нет, делаем заглавной первую букву типа (например, Info)
      const titleText = match[2].trim() || (type.charAt(0).toUpperCase() + type.slice(1));

      // Добавляем классы
      block.classList.add('obsidian-callout', `callout-${type}`);

      // Убираем служебный текст [!ТИП] и заголовок из абзаца
      firstP.innerHTML = firstP.innerHTML.replace(/^\[![a-zA-Z]+\](.*)/, '').trim();

      // Оборачиваем оставшийся контент
      const contentDiv = document.createElement('div');
      contentDiv.className = 'callout-content';
      while (block.firstChild) {
        contentDiv.appendChild(block.firstChild);
      }

      // Создаем красивый заголовок
      const titleDiv = document.createElement('div');
      titleDiv.className = 'callout-title';
      titleDiv.innerHTML = titleText;

      // Собираем блок обратно
      block.appendChild(titleDiv);
      block.appendChild(contentDiv);
    }
  });
});