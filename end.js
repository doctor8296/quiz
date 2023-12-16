// Максимальное количество рекордов
const MAX_HIGH_SCORES = 5;

const usernameInput = document.getElementById('username');
const mostRecentScore = Number(localStorage.getItem('mostRecentScore'));
const finalScore = document.getElementById('finalScore');
const saveScoreBtn = document.getElementById('saveScoreBtn');
finalScore.innerText = mostRecentScore;

const onChange = () => {
    saveScoreBtn.disabled = !username.value.trim();
};

// Событие изменения инпута
usernameInput.oninput = onChange;
usernameInput.onchange = onChange;

saveScoreBtn.onclick = (event) => {
    // Объект рекрордов
    const highScores = JSON.parse(localStorage.getItem('highScores')) || {};
    // Введённое имя пользователя
    const username = usernameInput.value;

    // Проверка на существования рекорда под введённым именем
    if (username in highScores) {
        // Проверка, если новый рекорд - больше
        if (highScores[username].score < mostRecentScore) {
            // Сохранение нового рекорда
            highScores[username].score = mostRecentScore;
        }
    } else {
        // Создание нового рекорда для введённого имени
        highScores[username] = {
            score: mostRecentScore
        }
    }

    // Создание массива на основе обновлённого объекта рекордов
    const recordsArray = Object.entries(highScores); 
    // Сортировка рекордов
    recordsArray.sort((a, b) => b[1].score - a[1].score);
    // Первые пять рекордов
    const firstFiveScores = recordsArray.slice(0, MAX_HIGH_SCORES);
    // Конвертирование массива в объект
    const newHighestScoresObject = Object.fromEntries(firstFiveScores);

    // Запись обновлённых рекордов
    localStorage.setItem('highScores', JSON.stringify(newHighestScoresObject));
};
