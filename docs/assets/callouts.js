document.addEventListener("DOMContentLoaded", function() {
    document.querySelectorAll('blockquote').forEach(function(block) {
        let firstP = block.querySelector('p');
        if (!firstP) return;

        let html = firstP.innerHTML;

        // Умный поиск: учитываем теги <br>, <br />, и любые переносы строк
        let match = html.match(/^\s*\[!([a-zA-Z]+)\](.*?)(?:<br\s*\/?>|\n)([\s\S]*)/i);

        // Если текст состоит всего из одной строки
        if (!match) {
            match = html.match(/^\s*\[!([a-zA-Z]+)\](.*)/i);
            if (match) match[3] = '';
        }

        if (match) {
            let type = match[1].toLowerCase();
            let titleText = match[2].trim() || (type.charAt(0).toUpperCase() + type.slice(1));
            let contentHtml = match[3].trim();

            // Очищаем текст от служебных меток
            if (contentHtml === '') {
                firstP.remove();
            } else {
                firstP.innerHTML = contentHtml;
            }

            // Добавляем классы стилей
            block.classList.add('obsidian-callout', 'callout-' + type);

            // Собираем плашку заголовка
            let titleDiv = document.createElement('div');
            titleDiv.className = 'callout-title';
            titleDiv.innerHTML = titleText;

            // Собираем блок с контентом
            let contentDiv = document.createElement('div');
            contentDiv.className = 'callout-content';
            while (block.firstChild) {
                contentDiv.appendChild(block.firstChild);
            }

            block.appendChild(titleDiv);
            block.appendChild(contentDiv);
        }
    });
});