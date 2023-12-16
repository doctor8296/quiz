
function dom(tag, {
  options={},
  attributes={},
  children=[],
  parent = false,
  init = false
}) {
  const element = Object.assign(document.createElement(tag), options);
  for (const attribute in attributes) {
    element.setAttribute(attribute, attributes[attribute]);
  }
  for (const child of children) {
    element.appendChild(child);
  }
  if (typeof init == 'function') {
    init(element);
  }
  return parent instanceof Element ? parent.appendChild(element) : element;
};

class AudioController {
  constructor(volume=1, muted=false) {
    this.volume = volume;
    this.muted = muted;
    this.audios = new Map();
  }

  add(name, src) {
    this.audios.set(name, new Audio(src));
  }

  addFew(audios) {
    for (const name in audios) {
      this.add(name, audios[name]);
    }
  }

  mute() {
    this.muted = true;
    for (const audio of this.audios.values()) {
      audio.muted = true;
    }
  }

  unmute() {
    this.muted = false;
    for (const audio of this.audios.values()) {
      audio.muted = false;
    }
  }

  setVolume(volume) {
    this.volume = volume;
    for (const audio of this.audios.values()) {
      audio.volume = volume;
    }
  }

  play(name) {
    if (!this.audios.has(name)) {
      throw new Error(`No such audio as "${name}" was found`);
    }
    const audio = this.audios.get(name);
    audio.volume = this.volume;
    audio.muted = this.muted;
    audio.pause();
    audio.currentTime = 0;
    audio.play();
  }
}

class Eventor {
  constructor() {
    this._events = new Map();
  }

  on(name, callback) {
    if (!(this._events.has(name))) {
      this._events.set(name, new Set());
    }
    this._events.get(name).add(callback);
  }

  off(name, callback) {
    if (this._events.has(name)) {
      return this._events.get(name).delete(callback);
    }
    return false;
  }

  dispatch(name, ...args) {
    if (this._events.has(name)) {
      for (const callback of this._events.get(name).values()) {
        callback(...args);
      }
    }
  }
}

class Game extends Eventor {
  constructor() {
    super();
    this.quiz = null;
    this.audioController = null;
    this.TESTS = null
  }

  async init() {
    this.initSound();
    await this.loadTests();
    this.selectFrame('menu');
  }

  async loadTests() {
    const response = await fetch('./tests.json');
    const data = await response.json();
    return this.TESTS = data;
  }

  initSound() {
    this.audioController = new AudioController();
    this.audioController.addFew({
      'success': './audio/success.mp3',
      'fail': './audio/fail.mp3',
      'end': './audio/end.mp3'
    });
    const muted = Number(localStorage.getItem('muted') ?? 0);
    const speakerButton = document.getElementById('speaker');
    speakerButton.onclick = () => {
      const muted = Number(localStorage.getItem('muted') ?? 0);
      if (muted) {
        localStorage.setItem('muted', 0);
        this.audioController.unmute();
        speakerButton.textContent = 'volume_up';
      } else {
        localStorage.setItem('muted', 1);
        this.audioController.mute();
        speakerButton.textContent = 'volume_off';
      }
    }
    if (muted) {
      speakerButton.textContent = 'volume_off';
      this.audioController.mute();
    }
  }

  selectFrame(name, data) {
    this.switchFrames(name);
    switch(name) {
      case 'menu': {
        const testsBlock = document.getElementById('tests');
        testsBlock.innerHTML = "";
        for (const test of this.TESTS) {
          dom('button', {
            options: {
              className: 'btn',
              textContent: test.name,
              onclick: () => {
                this.selectFrame('game', test);
              }
            },
            parent: testsBlock
          });
        }
        break;
      }
      case 'game': {
        if (this.quiz && !this.quiz.ended) {
          throw new Error('Quiz already running');
        }
        this.quiz = new Quiz(data);
        this.quiz.on('end', (reason, data) => {
          this.audioController.play('end');
          this.selectFrame('end', data);
        });
        this.quiz.on('success', () => this.audioController.play('success'));
        this.quiz.on('fail', () => this.audioController.play('fail'));
        this.quiz.start();
        break;
      }
      case 'end': {
        const score = data.score;

        ysdk.isAvailableMethod('leaderboards.setLeaderboardScore').then(avaliable => {
          if (avaliable) {
            ysdk.setLeaderboardScore('leader_borad_name', score);
          }
        })

        const finalScore = document.getElementById('finalScore');
        finalScore.textContent = score;
        const yourBestScore = document.getElementById('yourBestScore');
        const savedScore = Number(localStorage.getItem('score') || 0);
        if (savedScore < score) {
          localStorage.setItem('score', score);
        }
        yourBestScore.textContent = Math.max(savedScore, score);
        break;
      }
      default: {
        throw new Error(`Unknown frame "${name}"`);
      }
    }
  }

  switchFrames(name) {
    const frames = document.querySelectorAll('.container > .frame');
    for (const frame of frames) {
      frame.classList.add('hidden');
    }
    const currentFrame = document.querySelector(`.container > #${name}.frame`);
    if (!currentFrame) {
      throw new Error(`Frame "${name}" was no found in container`);
    }
    currentFrame.classList.remove('hidden');
  }
}

class Quiz extends Eventor {
  constructor({
    questions=[],
    randomizeQuestionsOrder=false,
    randomizeAnswersOrder=false,
    timeToSolveMS=-1,
    tickIntervalMS=1e3,
    nextQuestionDelayMS=-1,
    wheel=true
  }) {
    super();
    this.randomizeQuestionsOrder = randomizeQuestionsOrder;
    this.randomizeAnswersOrder = randomizeAnswersOrder;
    this.questions = randomizeQuestionsOrder ? questions.sort(() => (Math.random() > .5) ? 1 : -1) : questions;
    this.currentQuestionIndex = 0;
    this.wheel = wheel
    this.nextQuestionDelayMS = nextQuestionDelayMS;
    this.timeToSolveMS = timeToSolveMS;
    this.tickIntervalMS = tickIntervalMS;
    this.startTime = null;
    this.tickTimeoutID = null;
    this.score = 0;
    this.started = false;
    this.ended = false;
    this.acceptingAnswers = false;
  }

  start() {
    if (this.started) {
      throw new Error('Quiz already started');
    }
    this.score = 0;
    this.currentQuestionIndex = 0;
    this.started = true;
    this.acceptingAnswers = true;
    if (this.timeToSolveMS > 0) {
      this.startTime = Date.now();
      this.intervalID = setInterval(this.tick.bind(this), this.tickIntervalMS);
      this.tick();
    }
    this.renderQuestion(0);
  }

  tick() {
    const now = Date.now()
    if (this.startTime + this.timeToSolveMS < now) {
      clearInterval(this.intervalID);
      return this.end("time");
    }
    const elapsedTime = this.timeToSolveMS - (now - this.startTime);
    const minutes = Math.floor(elapsedTime / 6e4);
    const seconds = ((elapsedTime % 6e4) / 1e3).toFixed(0);
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    this.updateTimerText(formattedTime);
  }

  updateTimerText(time) {
    const countDownTimerElement = document.getElementById('count-down-timer');
    countDownTimerElement.classList.remove('inactive');
    countDownTimerElement.textContent = time;
  }

  step() {
    if (!this.started) {
      throw new Error('Quiz was not started yet');
    }
    this.acceptingAnswers = false;
    if (this.currentQuestionIndex < 0) {
      this.currentQuestionIndex = this.wheel ? this.questions.length - 1 : 0;
    }
    if (this.currentQuestionIndex >= this.questions.length) {
      if (this.nextQuestionDelayMS > 0) {
        this.questionFadeOut();
        setTimeout(() => {
          this.end('end');
        }, this.nextQuestionDelayMS / 2);
      } else {
        this.end('end');
      }
    } else {
      if (this.nextQuestionDelayMS > 0) {
        this.questionFadeOut();
        setTimeout(() => {
          this.renderQuestion(this.currentQuestionIndex);
          this.questionFadeIn();
        }, this.nextQuestionDelayMS / 2);
        setTimeout(() => {
          this.acceptingAnswers = true;
        }, this.nextQuestionDelayMS);
      } else {
        this.renderQuestion(this.currentQuestionIndex);
      }
    }
  }

  next() {
    this.currentQuestionIndex++;
    this.step();
  }

  back() {
    this.currentQuestionIndex--;
    this.step();
  }

  questionFadeOut() {
    const questionBlock = document.getElementById('questionBlock');
    questionBlock.style.transition = this.nextQuestionDelayMS + 'ms';
    questionBlock.style.opacity = 0;
  }

  questionFadeIn() {
    const questionBlock = document.getElementById('questionBlock');
    questionBlock.style.transition = this.nextQuestionDelayMS + 'ms';
    questionBlock.style.opacity = 1;
  }

  end(reason) {
    this.ended = true;
    clearInterval(this.intervalID);
    this.dispatch('end', reason, {score: this.score} );
  }

  success() {
    this.dispatch('success');
    const currentQuestion = this.questions[this.currentQuestionIndex];
    this.score += currentQuestion.rewardValue;
    this.updateScore();
  }

  fail() {
    this.dispatch('fail');
  }

  renderQuestion(questionIndex) {

    const currentQuestion = this.questions[questionIndex];

    this.updateCounter();
    this.updateBar();

    const questionBlock = document.getElementById("questionBlock");
    questionBlock.innerHTML = "";

    switch(currentQuestion.type) {
      case "one": {
        const answers = Object.entries(currentQuestion.answers);
        if (this.randomizeAnswersOrder) {
          answers.sort(() => (Math.random() > .5) ? 1 : -1);
        }
        dom('div', {
          options: {
            className: 'questionModal'
          },
          children: [
            dom('h2', {
              options: {
                id: 'question',
                textContent: currentQuestion.questionText
              },
            }),
          ]
          .concat(currentQuestion.extraHTML ? dom('div', {
            options: {
              className: '',
              innerHTML: currentQuestion.extraHTML 
            }
          }) : [])
          .concat(currentQuestion.image ? dom('div', {
            options: {
              className: 'question-image'
            },
            children: [
              dom('img', {
                options: {
                  src: currentQuestion.image
                }
              })
            ]
          }) : [])
          .concat([
            dom('div', {
              options: {
                className: 'answers-block',
                onclick: event => {
                  if (!this.acceptingAnswers) {
                    return;
                  }
                  const answerElement = event.target.closest('[data-index]') || event.target;
                  if (!answerElement.matches('[data-index]')) {
                    return;
                  }
                  const answerIndex = answerElement.dataset.index;
                  if (answerIndex == currentQuestion.correctAnswer) {
                    answerElement.classList.add('correct-animation');
                    this.success();
                  } else {
                    answerElement.classList.add('incorrect-animation');
                    this.fail();
                  }
                  this.next();
                }
              },
              children: answers.map(([answerIndex, answerText], index) => {
                return dom('div', {
                  options: {
                    className: 'choice-container'
                  },
                  children: [
                    dom('p', {
                      options: {
                        className: 'choice-prefix',
                        textContent: index + 1
                      }
                    }),
                    dom('p', {
                      options: {
                        className: 'choice-text',
                        textContent: answerText
                      }
                    })
                  ],
                  init: answerElement => {
                    answerElement.dataset.index = answerIndex;
                  }
                })
              })
            }),
            dom('div', {
              options: {
                className: 'hint-container',
              },
              children: [
                dom('button', {
                  options: {
                    className: 'hint-button btn',
                    id: 'hint',
                    textContent: 'Получить подсказку',
                    onclick: () => {
                      window.ysdk.adv.showRewardedVideo({
                        callbacks: {
                            onOpen: () => {
                              console.log('Video ad open.');
                            },
                            onRewarded: () => {
                              console.log('Rewarded!');
                              const rightAnswer = document.querySelector(`[data-index="${currentQuestion.answer}"]`);
                              rightAnswer.classList.add('correct-animation');
                            },
                            onClose: () => {
                              console.log('Video ad closed.');
                            }, 
                            onError: (e) => {
                              console.log('Error while open video ad:', e);
                            }
                        }
                      });
                    }
                  }
                })
              ]
            })
          ]),
          parent: questionBlock
        });
        break;
      }
      default: {
        throw new Error('Unknown question type');
      }
    }
  }

  updateQuestionText(text) {
    const questionTextElement = document.getElementById("question");
    questionTextElement.textContent = text;
  }

  updateCounter() {
    const progressText = document.getElementById("progressText");
    progressText.textContent = `${this.currentQuestionIndex + 1}/${this.questions.length}`;
  }

  updateBar() {
    const progressBarFiller = document.getElementById("progressBarFiller");
    progressBarFiller.style.width = (this.currentQuestionIndex + 1) / this.questions.length * 100 + '%';
  }

  updateScore() {
    const scoreELement = document.getElementById('score');
    scoreELement.textContent = this.score;
  }
}


const game = new Game();
game.init();

